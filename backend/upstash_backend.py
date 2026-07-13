import json
import requests
from django.core.cache.backends.base import BaseCache

class UpstashRESTCache(BaseCache):
    def __init__(self, server, params):
        super().__init__(params)
        self.url = server.rstrip('/')
        options = params.get('OPTIONS', {})
        self.token = options.get('TOKEN', '')
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def get(self, key, default=None, version=None):
        cache_key = self.make_and_validate_key(key, version=version)
        try:
            response = requests.get(f"{self.url}/get/{cache_key}", headers=self.headers, timeout=3)
            if response.status_code == 200:
                result = response.json().get("result")
                if result is not None:
                    try:
                        return json.loads(result)
                    except (ValueError, TypeError):
                        return result
        except Exception as e:
            print(f"\n[DEBUG GET ERROR] {e}")
        return default

    def set(self, key, value, timeout=None, version=None):
        cache_key = self.make_and_validate_key(key, version=version)
        if timeout is None:
            timeout = self.default_timeout

        try:
            payload = json.dumps(value)
            if timeout and timeout > 0:
                command = ["SET", cache_key, payload, "EX", str(timeout)]
            else:
                command = ["SET", cache_key, payload]

            response = requests.post(self.url, headers=self.headers, json=command, timeout=3)

            # --- DEBUG PRINTS ---
            print(f"\n--- UPSTASH DEBUG ---")
            print(f"URL: {self.url}")
            print(f"Token length: {len(self.token)} chars")
            print(f"HTTP Status: {response.status_code}")
            print(f"Response Body: {response.text}")
            print(f"---------------------\n")

            return response.status_code == 200
        except Exception as e:
            print(f"\n[DEBUG SET EXCEPTION] {e}\n")
            return False

    def delete(self, key, version=None):
        cache_key = self.make_and_validate_key(key, version=version)
        try:
            response = requests.post(self.url, headers=self.headers, json=["DEL", cache_key], timeout=3)
            return response.status_code == 200
        except Exception:
            return False