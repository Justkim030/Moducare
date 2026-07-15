from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'referrals', views.ReferralViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
