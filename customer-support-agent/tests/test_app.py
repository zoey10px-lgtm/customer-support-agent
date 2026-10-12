import io
import json
import os
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import server

class AppTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.http.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()

    def post(self, payload):
        request = Request(self.base + "/api/analyze", json.dumps(payload).encode(),
                          {"Content-Type": "application/json"})
        with urlopen(request) as response:
            return json.load(response)

    def test_each_demo_retrieves_its_lot_and_case_without_review_leak(self):
        for complaint in server.DATA["demo_complaints"]:
            context = server.retrieve(complaint["message"], lot_hint=complaint["lot_id"])
            self.assertEqual(context["lots"][0]["id"], complaint["lot_id"])
            expected = complaint["expected_review"]["suggested_historical_case_ids"]
            self.assertTrue(set(expected) <= {x["id"] for x in context["historical_cases"]})
            self.assertNotIn("expected_review", json.dumps(context))

    def test_unknown_lot_does_not_load_unrelated_inspection(self):
        context = server.retrieve("LOT-N-999에 긁힘이 있습니다")
        self.assertEqual(context["lots"], [])
        self.assertEqual(context["unknown_lot_ids"], ["LOT-N-999"])
        self.assertFalse(any(x["lot_id"].startswith("LOT-N") for x in context["records"]))

    def test_http_analysis_and_followup(self):
        sample = server.DATA["demo_complaints"][0]
        with patch.object(server, "call_openai", return_value=("조사 중입니다.", {"input_tokens": 100, "output_tokens": 10})) as mock:
            result = self.post({"message": sample["message"]})
            self.assertEqual(result["answer"], "조사 중입니다.")
            self.assertTrue(any(x["id"] == "INS-N-001" for x in result["sources"]))
            history = [{"role": "user", "content": sample["message"]},
                       {"role": "assistant", "content": result["answer"]}]
            self.post({"message": "교환 절차를 알려주세요", "history": history})
            inputs = mock.call_args[0][0]
            self.assertIn("INS-N-001", inputs[0]["content"])
            self.assertEqual(inputs[-1]["content"], "교환 절차를 알려주세요")

    def test_missing_key_returns_clear_error(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
            with self.assertRaises(HTTPError) as caught:
                self.post({"message": "LOT-N-001에 긁힘이 있어요"})
            self.assertEqual(caught.exception.code, 400)
            self.assertIn(".env", json.load(caught.exception)["error"])

    def test_secret_and_data_not_served(self):
        for path in ["/.env", "/server.py", "/data/manufacturing_complaints_synthetic.json"]:
            with self.assertRaises(HTTPError) as caught:
                urlopen(self.base + path)
            self.assertEqual(caught.exception.code, 404)
        with urlopen(self.base + "/") as response:
            self.assertIn('/app.js', response.read().decode())

    def test_empty_input_and_cross_origin(self):
        with self.assertRaises(HTTPError) as caught:
            self.post({"message": ""})
        self.assertEqual(caught.exception.code, 400)
        request = Request(self.base + "/api/analyze", b'{}', {"Origin": "https://other.example"})
        with self.assertRaises(HTTPError) as caught:
            urlopen(request)
        self.assertEqual(caught.exception.code, 403)

    def test_responses_request_and_text_extraction(self):
        response = io.BytesIO(json.dumps({"status": "completed", "output": [
            {"type": "message", "content": [{"type": "output_text", "text": "확인했습니다."}]}],
            "usage": {"input_tokens": 50, "output_tokens": 5}}).encode())
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-only-not-a-real-key"}):
            with patch.object(server, "urlopen", return_value=response) as mock:
                text, usage = server.call_openai([{"role": "user", "content": "문의"}])
                body = json.loads(mock.call_args[0][0].data)
                self.assertEqual(body["store"], False)
                self.assertEqual(body["input"][0]["content"], "문의")
                self.assertEqual(text, "확인했습니다.")
                self.assertEqual(usage["input_tokens"], 50)

if __name__ == "__main__":
    unittest.main()
