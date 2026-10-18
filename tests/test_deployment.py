import os
import threading
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import json
import server
import test_app


class DeploymentTests(unittest.TestCase):
    setUpClass = classmethod(test_app.AppTests.setUpClass.__func__)
    tearDownClass = classmethod(test_app.AppTests.tearDownClass.__func__)

    def test_health_and_access_configuration_do_not_disclose_code(self):
        with patch.dict(os.environ, {'DEMO_ACCESS_CODE': 'test-demo-private'}):
            with urlopen(self.base + '/healthz') as response:
                self.assertEqual(json.load(response), {'status': 'ok'})
            with urlopen(self.base + '/api/config') as response:
                self.assertEqual(json.load(response), {'access_required': True})

    def test_https_origin_and_access_code(self):
        env = {'DEMO_ACCESS_CODE': 'test-demo-private', 'RENDER_EXTERNAL_URL': 'https://example.onrender.com',
               'PUBLIC_BASE_URL': ''}
        with patch.dict(os.environ, env):
            for code, status in [('', 401), ('wrong', 401), ('test-demo-private', 200)]:
                request = Request(self.base+'/api/analyze', json.dumps({'message': '긁힘이 있어요'}).encode(),
                                  {'Content-Type': 'application/json', 'Origin': 'https://example.onrender.com',
                                   'X-Demo-Code': code})
                with patch.object(server, 'call_openai', return_value=('draft', {})) as api:
                    if status == 200:
                        with urlopen(request) as response:
                            self.assertEqual(response.status, 200)
                        api.assert_called_once()
                    else:
                        with self.assertRaises(HTTPError) as error:
                            urlopen(request)
                        self.assertEqual(error.exception.code, status)
                        api.assert_not_called()
            self.assertFalse(server.allowed_origin('https://example.onrender.com.attacker.test', 'example.onrender.com'))
            self.assertFalse(server.allowed_origin('http://example.onrender.com', 'example.onrender.com'))

    def test_global_limit_rejects_without_more_api_calls(self):
        with patch.dict(os.environ, {'MAX_ANALYSES_PER_HOUR': '1', 'MAX_CONCURRENT_ANALYSES': '1', 'DEMO_ACCESS_CODE': ''}):
            with patch.object(server, 'LIMITER', server.DemoLimiter()):
                with patch.object(server, 'call_openai', return_value=('draft', {})) as api:
                    for i in range(2):
                        request = Request(self.base+'/api/analyze', b'{"message":"scratch"}', {'Content-Type':'application/json'})
                        if i == 0:
                            with urlopen(request) as response:
                                self.assertEqual(response.status, 200)
                            count = api.call_count
                        else:
                            with self.assertRaises(HTTPError) as error:
                                urlopen(request)
                            self.assertEqual(error.exception.code, 429)
                            self.assertEqual(api.call_count, count)

    def test_concurrency_slot_is_released_on_error(self):
        limiter = server.DemoLimiter()
        with patch.dict(os.environ, {'MAX_CONCURRENT_ANALYSES':'1'}):
            with self.assertRaises(ValueError):
                with limiter.slot():
                    with self.assertRaises(server.DemoBusyError):
                        with limiter.slot():
                            pass
                    raise ValueError('upstream failure')
            with limiter.slot():
                self.assertEqual(limiter.active, 1)
            self.assertEqual(limiter.active, 0)
