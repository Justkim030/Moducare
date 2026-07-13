from django.apps import AppConfig

class RecordsConfig(AppConfig): # Whatever this class is named...
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.users'  