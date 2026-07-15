
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'', views.VisitViewSet, basename='visit')
router.register(r'ward-logs', views.WardLogViewSet, basename='wardlog')

urlpatterns = [
    path('', include(router.urls)),
]