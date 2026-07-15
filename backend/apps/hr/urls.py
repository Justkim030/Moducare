from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'staff', views.StaffViewSet)
router.register(r'profiles', views.EmployeeProfileViewSet)
router.register(r'contracts', views.ContractViewSet)
router.register(r'trainings', views.TrainingRecordViewSet)
router.register(r'performance', views.PerformanceReviewViewSet)
router.register(r'payroll', views.PayrollRecordViewSet)
router.register(r'attendance', views.TimeAttendanceViewSet)
router.register(r'leave', views.LeaveRequestViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

