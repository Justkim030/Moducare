from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet)
router.register(r'employees', views.EmployeeViewSet)

urlpatterns = [
    # 1. Manually add the route for your custom APIView BEFORE the router patterns
    path('employees/me/', views.CurrentEmployeeProfileView.as_view(), name='employee-me'),
    
    # 2. Keep your automated router URLs down here
    path('', include(router.urls)),
]