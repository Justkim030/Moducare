from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'', views.EmployeeViewSet)
router.register(r'', views.EmployeeProfileViewSet)
router.register(r'', views.ContractViewSet)
router.register(r'', views.TrainingRecordViewSet)
router.register(r'', views.PerformanceReviewViewSet)
router.register(r'', views.PayrollRecordViewSet)
router.register(r'', views.TimeAttendanceViewSet)
router.register(r'', views.LeaveRequestViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

