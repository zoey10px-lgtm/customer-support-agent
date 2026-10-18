import base64
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import urlopen
import server
import test_app

PNG = 'data:image/webp;base64,' + base64.b64encode(
    (server.ROOT / 'public/assets/aluminum-case.webp').read_bytes()).decode()
OBSERVATION = {'observations': '표면에 선형 손상이 의심됩니다.', 'limitations': '원인은 사진으로 확정할 수 없습니다.',
               'search_terms_ko': '긁힘', 'defect_type_ids': ['DEF-SCRATCH'], 'assessment': 'suspected_defect'}


class WebsiteTests(unittest.TestCase):
    setUpClass = classmethod(test_app.AppTests.setUpClass.__func__)
    tearDownClass = classmethod(test_app.AppTests.tearDownClass.__func__)
    post = test_app.AppTests.post

    def test_company_pages_assets_and_product_query_are_served(self):
        for path, mime in [('/', 'text/html'), ('/company.html', 'text/html'), ('/products.html', 'text/html'),
                           ('/quality.html', 'text/html'), ('/support.html?product=HB-CASE-100', 'text/html'),
                           ('/site.css', 'text/css'), ('/site-content.js', 'text/javascript'),
                           ('/assets/aluminum-case.webp', 'image/webp'), ('/assets/steel-cover.webp', 'image/webp'),
                           ('/assets/mounting-bracket.webp', 'image/webp')]:
            with self.subTest(path=path):
                with urlopen(self.base + path) as response:
                    self.assertEqual(response.status, 200)
                    self.assertIn(mime, response.headers['Content-Type'])
                    self.assertTrue(response.read())
        for path in ['/../server.py', '/assets/../../.env', '/data/manufacturing_complaints_synthetic.json']:
            with self.assertRaises(HTTPError):
                urlopen(self.base + path)

    def test_photos_reach_vision_and_find_records_before_reply(self):
        with patch.object(server, 'call_openai', side_effect=[
            (json.dumps(OBSERVATION, ensure_ascii=False), {'input_tokens': 40, 'output_tokens': 20}),
            ('회신 초안', {'input_tokens': 70, 'output_tokens': 30})]) as api:
            result = self.post({'message': '이 사진을 확인해주세요', 'product': 'HB-CASE-100',
                                'lot': 'LOT-N-001', 'images': [{'data_url': PNG}]})
            first = api.call_args_list[0].args[0][0]['content']
            self.assertEqual(first[1]['type'], 'input_image')
            self.assertEqual(first[1]['image_url'], PNG)
            self.assertEqual(result['image_analysis']['defect_type_ids'], ['DEF-SCRATCH'])
            self.assertTrue(any(x['id'] == 'CASE-001' for x in result['sources']))
            self.assertIn('AI 관찰', api.call_args_list[1].args[0][1]['content'])
            self.assertEqual(result['usage']['input_tokens'], 110)

    def test_invalid_or_remote_photos_are_rejected_before_api(self):
        for images in [[{'data_url': 'https://example.com/photo.png'}], [{'data_url': 'data:image/png;base64,YWJj'}],
                       [{'data_url': PNG}]*4, 'wrong']:
            with patch.object(server, 'call_openai') as api:
                with self.assertRaises(HTTPError) as error:
                    self.post({'message': '사진 확인', 'images': images})
                self.assertEqual(error.exception.code, 400)
                api.assert_not_called()

    def test_normal_or_unrelated_photos_do_not_add_defect_keywords(self):
        for assessment in ['no_visible_defect', 'unclear', 'unrelated']:
            data = dict(OBSERVATION, assessment=assessment)
            with patch.object(server, 'call_openai', return_value=(json.dumps(data), {})):
                result, _ = server.analyze_images([PNG], 'en')
                self.assertEqual(result['search_terms_ko'], '')
                self.assertEqual(result['defect_type_ids'], [])

    def test_malformed_vision_output_stops_before_reply_generation(self):
        for value in ['not JSON', '{}', '[]']:
            with patch.object(server, 'call_openai', return_value=(value, {})) as api:
                with self.assertRaises(HTTPError):
                    self.post({'message': '사진 확인', 'images': [{'data_url': PNG}]})
                self.assertEqual(api.call_count, 1)
