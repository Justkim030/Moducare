# medicines app

This app provides a simple `Medicine` model plus JSON endpoints for basic CRUD operations.

Endpoints (JSON):

- GET /medicines/ — list all medicines
- POST /medicines/ — create a medicine (JSON body: name, quantity, price)
- GET /medicines/<id>/ — retrieve
- PUT /medicines/<id>/ — update (JSON body partial or full)
- DELETE /medicines/<id>/ — delete

To install and run:

1. Activate your virtualenv and install Django (already present in repo venv).
2. Run migrations:

```sh
python manage.py makemigrations medicines
python manage.py migrate
```

3. Run server:

```sh
python manage.py runserver
```
