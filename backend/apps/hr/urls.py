from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'employees', views.EmployeeViewSet)
router.register(r'employee-profiles', views.EmployeeProfileViewSet)
router.register(r'contracts', views.ContractViewSet)
router.register(r'training-records', views.TrainingRecordViewSet)
router.register(r'performance-reviews', views.PerformanceReviewViewSet)
router.register(r'payroll-records', views.PayrollRecordViewSet)
router.register(r'time-attendance', views.TimeAttendanceViewSet)
router.register(r'leave-requests', views.LeaveRequestViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
