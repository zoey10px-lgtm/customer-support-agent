import io
import json
import os
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
import server
import test_app


class LanguageTests(unittest.TestCase):
    setUpClass = classmethod(test_app.AppTests.setUpClass.__func__)
    tearDownClass = classmethod(test_app.AppTests.tearDownClass.__func__)
    post = test_app.AppTests.post

    def test_foreign_input_translates_before_retrieval_and_keeps_original(self):
        for language, text in [('en', 'There are scratches on LOT-N-001.'),
                               ('vi', 'Có vết xước trên LOT-N-001.')]:
            with self.subTest(language=language):
                with patch.object(server, 'call_openai', side_effect=[
                    ('LOT-N-001에 긁힘이 있습니다.', {'input_tokens': 20, 'output_tokens': 10}),
                    ('Draft', {'input_tokens': 100, 'output_tokens': 50})]) as api:
                    result = self.post({'message': text, 'language': language})
                    self.assertEqual(api.call_count, 2)
                    self.assertIn('Translate manufacturing', api.call_args_list[0].kwargs['instructions'])
                    final = api.call_args_list[1]
                    self.assertEqual(final.kwargs['language'], language)
                    self.assertEqual(final.args[0][-1]['content'], text)
                    self.assertIn('INS-N-001', final.args[0][0]['content'])
                    self.assertTrue(any(x['id'] == 'CASE-001' for x in result['sources']))
                    self.assertEqual(result['usage']['input_tokens'], 120)
                    self.assertEqual(result['usage']['output_tokens'], 60)

    def test_output_language_does_not_control_input_language(self):
        with patch.object(server, 'call_openai', return_value=('English reply', {})) as api:
            self.post({'message': 'LOT-N-001에 긁힘이 있어요', 'language': 'en'})
            self.assertEqual(api.call_count, 1)
            self.assertEqual(api.call_args.kwargs['language'], 'en')
        with patch.object(server, 'call_openai', side_effect=[('긁힘이 있어요', {}), ('한국어 회신', {})]) as api:
            self.post({'message': 'There are scratches.', 'language': 'ko'})
            self.assertEqual(api.call_count, 2)
            self.assertEqual(api.call_args.kwargs['language'], 'ko')

    def test_each_output_language_is_in_request_instructions(self):
        for language, name in server.LANGUAGES.items():
            response = io.BytesIO(json.dumps({'output': [{'content': [{'type': 'output_text', 'text': 'draft'}]}]}).encode())
            with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}):
                with patch.object(server, 'urlopen', return_value=response) as api:
                    server.call_openai([{'role': 'user', 'content': '민원'}], language=language)
                    body = json.loads(api.call_args.args[0].data)
                    self.assertIn(name, body['instructions'])
                    self.assertIn('원문 언어와 이전 대화', body['instructions'])

    def test_unsupported_language_is_rejected_without_api_call(self):
        for language in ['xx', [], None]:
            with patch.object(server, 'call_openai') as api:
                with self.assertRaises(HTTPError) as error:
                    self.post({'message': '민원입니다', 'language': language})
                self.assertEqual(error.exception.code, 400)
                api.assert_not_called()

    def test_translation_failure_does_not_generate_ungrounded_reply(self):
        with patch.object(server, 'call_openai', side_effect=ValueError('API 연결에 실패했습니다.')) as api:
            with self.assertRaises(HTTPError):
                self.post({'message': 'There are dents.', 'language': 'vi'})
            self.assertEqual(api.call_count, 1)

    def test_translation_retains_identifiers_for_search(self):
        with patch.object(server, 'call_openai', return_value=('긁힘', {})):
            text, _ = server.prepare_search_text('scratch HB-CASE-100 LOT-N-001')
            self.assertIn('HB-CASE-100', text)
            self.assertIn('LOT-N-001', text)
