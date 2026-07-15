from django.contrib import admin
from .models import (
    Staff,
    EmployeeProfile,
    Contract,
    TrainingRecord,
    PerformanceReview,
    PayrollRecord,
    TimeAttendance,
    LeaveRequest,
)

admin.site.register(Staff)
admin.site.register(EmployeeProfile)
admin.site.register(Contract)
admin.site.register(TrainingRecord)
admin.site.register(PerformanceReview)
admin.site.register(PayrollRecord)
admin.site.register(TimeAttendance)
admin.site.register(LeaveRequest)
