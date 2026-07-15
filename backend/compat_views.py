"""
Compatibility views for the old vanilla JS frontend.

Wraps DRF ViewSet responses in the legacy shape:
  { ok: true, <resource>: [...] }
and adds missing endpoints: /dashboard, /activities, /search.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta

from apps.patients.models import Patient
from apps.visits.models import Visits
from apps.lab.models import TestRequest
from apps.prescriptions.models import Prescription
from apps.accounts.models import Invoice, Payment
from apps.appointments.models import Appointment
from apps.communications.models import Notification
from apps.quality.models import IncidentReport
from apps.inventory.models import Medicine
from apps.reports.models import Report
from apps.audit.models import Audit
from apps.operations.models import Operation, Activity, CalendarEvent
from apps.finance.models import Finance
from apps.hr.models import Staff, TimeAttendance, LeaveRequest
from apps.users.models import Users, Employee

from compat_serializers import (
    CompatPatientSerializer,
    CompatAppointmentSerializer,
    CompatNotificationSerializer,
    CompatIncidentSerializer,
    CompatUserSerializer,
    CompatFinanceSerializer,
    CompatOperationSerializer,
)
from apps.patients.serializers import PatientSerializer
from apps.visits.serializers import VisitSerializer
from apps.lab.serializers import TestRequestSerializer
from apps.quality.serializers import IncidentReportSerializer
from apps.inventory.serializers import MedicineSerializer
from apps.operations.serializers import ActivitySerializer, CalendarEventSerializer
from apps.hr.serializers import StaffSerializer


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats = {
            'patients': Patient.objects.count(),
            'appointments': Appointment.objects.filter(
                appointment_date__gte=timezone.now() - timedelta(days=30)
            ).count(),
            'incidents': IncidentReport.objects.filter(
                incident_date__gte=timezone.now() - timedelta(days=30)
            ).count(),
            'notifications': Notification.objects.filter(
                recipient=request.user, is_read=False
            ).count(),
        }
        return Response({'ok': True, 'stats': stats})


class ActivitiesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        activities = Activity.objects.all().select_related('operation').order_by('-created_at')[:50]
        data = ActivitySerializer(activities, many=True).data
        return Response({'ok': True, 'activities': data})


class SearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        type_ = request.query_params.get('type', 'all')
        if not q:
            return Response({'ok': True, 'patients': [], 'encounters': [], 'labOrders': []})

        result = {'ok': True, 'patients': [], 'encounters': [], 'labOrders': []}

        if type_ in ('all', 'patients'):
            patients = Patient.objects.filter(
                Q(name__first_name__icontains=q) |
                Q(name__second_name__icontains=q) |
                Q(name__phone_number__icontains=q)
            )[:10]
            result['patients'] = CompatPatientSerializer(patients, many=True).data

        if type_ in ('all', 'encounters'):
            visits = Visits.objects.filter(
                Q(patient__name__first_name__icontains=q) |
                Q(patient__name__second_name__icontains=q)
            )[:10]
            result['encounters'] = VisitSerializer(visits, many=True).data

        if type_ in ('all', 'labOrders'):
            labs = TestRequest.objects.filter(
                Q(patient__name__first_name__icontains=q) |
                Q(test__name__icontains=q)
            )[:10]
            result['labOrders'] = TestRequestSerializer(labs, many=True).data

        return Response(result)


class CompatPatientList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Patient.objects.all().select_related('name')
        q = request.query_params.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(name__first_name__icontains=q) |
                Q(name__second_name__icontains=q) |
                Q(name__phone_number__icontains=q)
            )
        qs = qs.order_by('-register_date')
        serializer = CompatPatientSerializer(qs, many=True)
        return Response({'ok': True, 'patients': serializer.data})

    def post(self, request):
        serializer = CompatPatientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name_data = serializer.validated_data.pop('name', {})
        from apps.users.models import Names
        name_instance = Names.objects.create(**name_data)
        patient_instance = Patient.objects.create(name=name_instance, **serializer.validated_data)
        return Response({'ok': True, 'patient': CompatPatientSerializer(patient_instance).data}, status=status.HTTP_201_CREATED)


class CompatPatientDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            patient = Patient.objects.select_related('name').get(pk=pk)
        except Patient.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        return Response({'ok': True, 'patient': CompatPatientSerializer(patient).data})

    def put(self, request, pk):
        try:
            patient = Patient.objects.select_related('name').get(pk=pk)
        except Patient.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatPatientSerializer(patient, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        name_data = serializer.validated_data.pop('name', None)
        if name_data and patient.name:
            for attr, value in name_data.items():
                setattr(patient.name, attr, value)
            patient.name.save()
        for attr, value in serializer.validated_data.items():
            setattr(patient, attr, value)
        patient.save()
        return Response({'ok': True, 'patient': CompatPatientSerializer(patient).data})

    def patch(self, request, pk):
        try:
            patient = Patient.objects.select_related('name').get(pk=pk)
        except Patient.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatPatientSerializer(patient, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        name_data = serializer.validated_data.pop('name', None)
        if name_data and patient.name:
            for attr, value in name_data.items():
                setattr(patient.name, attr, value)
            patient.name.save()
        for attr, value in serializer.validated_data.items():
            setattr(patient, attr, value)
        patient.save()
        return Response({'ok': True, 'patient': CompatPatientSerializer(patient).data})

    def delete(self, request, pk):
        try:
            patient = Patient.objects.get(pk=pk)
        except Patient.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        patient.delete()
        return Response({'ok': True})


class CompatIncidentList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = IncidentReport.objects.all().order_by('-incident_date')
        serializer = CompatIncidentSerializer(qs, many=True)
        return Response({'ok': True, 'incidents': serializer.data})

    def post(self, request):
        serializer = CompatIncidentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'incident': serializer.data}, status=status.HTTP_201_CREATED)


class CompatIncidentDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            incident = IncidentReport.objects.get(pk=pk)
        except IncidentReport.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        return Response({'ok': True, 'incident': CompatIncidentSerializer(incident).data})

    def put(self, request, pk):
        try:
            incident = IncidentReport.objects.get(pk=pk)
        except IncidentReport.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatIncidentSerializer(incident, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'incident': serializer.data})

    def patch(self, request, pk):
        try:
            incident = IncidentReport.objects.get(pk=pk)
        except IncidentReport.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatIncidentSerializer(incident, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'incident': serializer.data})

    def delete(self, request, pk):
        try:
            incident = IncidentReport.objects.get(pk=pk)
        except IncidentReport.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        incident.delete()
        return Response({'ok': True})


class CompatInventoryList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Medicine.objects.all().order_by('name')
        serializer = MedicineSerializer(qs, many=True)
        return Response({'ok': True, 'inventory': serializer.data})

    def post(self, request):
        from apps.inventory.serializers import MedicineSerializer
        serializer = MedicineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'item': serializer.data}, status=status.HTTP_201_CREATED)


class CompatInventoryDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            item = Medicine.objects.get(pk=pk)
        except Medicine.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        return Response({'ok': True, 'item': MedicineSerializer(item).data})

    def put(self, request, pk):
        try:
            item = Medicine.objects.get(pk=pk)
        except Medicine.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = MedicineSerializer(item, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'item': serializer.data})

    def patch(self, request, pk):
        try:
            item = Medicine.objects.get(pk=pk)
        except Medicine.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = MedicineSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'item': serializer.data})

    def delete(self, request, pk):
        try:
            item = Medicine.objects.get(pk=pk)
        except Medicine.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        item.delete()
        return Response({'ok': True})


class CompatAppointmentList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Appointment.objects.all().select_related('patient__name', 'doctor').order_by('appointment_date')
        status = request.query_params.get('status', '')
        if status:
            qs = qs.filter(status=status)
        serializer = CompatAppointmentSerializer(qs, many=True)
        return Response({'ok': True, 'appointments': serializer.data})

    def post(self, request):
        serializer = CompatAppointmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'appointment': serializer.data}, status=status.HTTP_201_CREATED)


class CompatAppointmentDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            appt = Appointment.objects.select_related('patient__name', 'doctor').get(pk=pk)
        except Appointment.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        return Response({'ok': True, 'appointment': CompatAppointmentSerializer(appt).data})

    def put(self, request, pk):
        try:
            appt = Appointment.objects.select_related('patient__name', 'doctor').get(pk=pk)
        except Appointment.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatAppointmentSerializer(appt, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'appointment': serializer.data})

    def patch(self, request, pk):
        try:
            appt = Appointment.objects.select_related('patient__name', 'doctor').get(pk=pk)
        except Appointment.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatAppointmentSerializer(appt, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'appointment': serializer.data})

    def delete(self, request, pk):
        try:
            appt = Appointment.objects.get(pk=pk)
        except Appointment.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        appt.delete()
        return Response({'ok': True})


class CompatNotificationList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user).order_by('-created_at')
        unread = request.query_params.get('unread', '')
        if unread == 'true':
            qs = qs.filter(is_read=False)
        serializer = CompatNotificationSerializer(qs, many=True)
        return Response({'ok': True, 'notifications': serializer.data})

    def post(self, request):
        serializer = CompatNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(recipient=request.user)
        return Response({'ok': True, 'notification': serializer.data}, status=status.HTTP_201_CREATED)


class CompatNotificationBroadcast(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({'ok': True, 'message': 'Broadcast sent'})


class EmployeeMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            employee = Employee.objects.select_related('user__name').get(user=request.user)
            from apps.users.serializers import EmployeeSerializer
            serializer = EmployeeSerializer(employee)
            return Response({'ok': True, 'employee': serializer.data})
        except Employee.DoesNotExist:
            return Response({'ok': False, 'error': 'Employee profile not found.'}, status=404)


class CompatUserList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Users.objects.all().select_related('name')
        q = request.query_params.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(name__first_name__icontains=q) |
                Q(name__second_name__icontains=q) |
                Q(username__icontains=q)
            )
        qs = qs.order_by('-id')
        serializer = CompatUserSerializer(qs, many=True)
        return Response({'ok': True, 'users': serializer.data})

    def post(self, request):
        serializer = CompatUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name_data = serializer.validated_data.pop('name', {})
        from apps.users.models import Names
        name_instance = Names.objects.create(**name_data)
        user = Users.objects.create_user(
            username=serializer.validated_data.get('username', ''),
            password=serializer.validated_data.get('password', ''),
        )
        user.name = name_instance
        for attr, value in serializer.validated_data.items():
            setattr(user, attr, value)
        user.save()
        return Response({'ok': True, 'user': CompatUserSerializer(user).data}, status=status.HTTP_201_CREATED)


class CompatUserDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            user = Users.objects.select_related('name').get(pk=pk)
        except Users.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        return Response({'ok': True, 'user': CompatUserSerializer(user).data})

    def put(self, request, pk):
        try:
            user = Users.objects.select_related('name').get(pk=pk)
        except Users.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatUserSerializer(user, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        name_data = serializer.validated_data.pop('name', None)
        if name_data and user.name:
            for attr, value in name_data.items():
                setattr(user.name, attr, value)
            user.name.save()
        for attr, value in serializer.validated_data.items():
            setattr(user, attr, value)
        user.save()
        return Response({'ok': True, 'user': CompatUserSerializer(user).data})

    def patch(self, request, pk):
        try:
            user = Users.objects.select_related('name').get(pk=pk)
        except Users.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatUserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        name_data = serializer.validated_data.pop('name', None)
        if name_data and user.name:
            for attr, value in name_data.items():
                setattr(user.name, attr, value)
            user.name.save()
        for attr, value in serializer.validated_data.items():
            setattr(user, attr, value)
        user.save()
        return Response({'ok': True, 'user': CompatUserSerializer(user).data})

    def delete(self, request, pk):
        try:
            user = Users.objects.get(pk=pk)
        except Users.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        user.delete()
        return Response({'ok': True})


class CompatFinanceList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Finance.objects.all().order_by('-date')
        status = request.query_params.get('status', '')
        if status:
            qs = qs.filter(category=status)
        serializer = CompatFinanceSerializer(qs, many=True)
        return Response({'ok': True, 'finance': serializer.data})

    def post(self, request):
        serializer = CompatFinanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'entry': serializer.data}, status=status.HTTP_201_CREATED)


class CompatFinanceDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            entry = Finance.objects.get(pk=pk)
        except Finance.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        return Response({'ok': True, 'entry': CompatFinanceSerializer(entry).data})

    def put(self, request, pk):
        try:
            entry = Finance.objects.get(pk=pk)
        except Finance.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatFinanceSerializer(entry, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'entry': serializer.data})

    def patch(self, request, pk):
        try:
            entry = Finance.objects.get(pk=pk)
        except Finance.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatFinanceSerializer(entry, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'entry': serializer.data})

    def delete(self, request, pk):
        try:
            entry = Finance.objects.get(pk=pk)
        except Finance.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        entry.delete()
        return Response({'ok': True})


class CompatOperationList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Operation.objects.all().order_by('-start_date')
        status = request.query_params.get('status', '')
        if status:
            qs = qs.filter(status=status)
        serializer = CompatOperationSerializer(qs, many=True)
        return Response({'ok': True, 'operations': serializer.data})

    def post(self, request):
        serializer = CompatOperationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'operation': serializer.data}, status=status.HTTP_201_CREATED)


class CompatOperationDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            op = Operation.objects.get(pk=pk)
        except Operation.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        return Response({'ok': True, 'operation': CompatOperationSerializer(op).data})

    def put(self, request, pk):
        try:
            op = Operation.objects.get(pk=pk)
        except Operation.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatOperationSerializer(op, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'operation': serializer.data})

    def patch(self, request, pk):
        try:
            op = Operation.objects.get(pk=pk)
        except Operation.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CompatOperationSerializer(op, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'operation': serializer.data})

    def delete(self, request, pk):
        try:
            op = Operation.objects.get(pk=pk)
        except Operation.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        op.delete()
        return Response({'ok': True})


class CompatStaffList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Staff.objects.all().select_related('user__name')
        status = request.query_params.get('status', '')
        if status:
            qs = qs.filter(status=status)
        serializer = StaffSerializer(qs, many=True)
        return Response({'ok': True, 'staff': serializer.data})

    def post(self, request):
        serializer = StaffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'staff': serializer.data}, status=status.HTTP_201_CREATED)


class CompatStaffDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            staff = Staff.objects.select_related('user__name').get(pk=pk)
        except Staff.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        return Response({'ok': True, 'staff': StaffSerializer(staff).data})

    def put(self, request, pk):
        try:
            staff = Staff.objects.select_related('user__name').get(pk=pk)
        except Staff.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = StaffSerializer(staff, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'staff': serializer.data})

    def patch(self, request, pk):
        try:
            staff = Staff.objects.select_related('user__name').get(pk=pk)
        except Staff.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = StaffSerializer(staff, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'staff': serializer.data})

    def delete(self, request, pk):
        try:
            staff = Staff.objects.get(pk=pk)
        except Staff.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        staff.delete()
        return Response({'ok': True})


class CompatEventList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = CalendarEvent.objects.all().select_related('employee')
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        if start and end:
            qs = qs.filter(start_time__gte=start, start_time__lte=end)
        qs = qs.order_by('start_time')
        serializer = CalendarEventSerializer(qs, many=True)
        return Response({'ok': True, 'events': serializer.data})

    def post(self, request):
        serializer = CalendarEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'event': serializer.data}, status=status.HTTP_201_CREATED)


class CompatEventDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            event = CalendarEvent.objects.select_related('employee').get(pk=pk)
        except CalendarEvent.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        return Response({'ok': True, 'event': CalendarEventSerializer(event).data})

    def put(self, request, pk):
        try:
            event = CalendarEvent.objects.select_related('employee').get(pk=pk)
        except CalendarEvent.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CalendarEventSerializer(event, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'event': serializer.data})

    def patch(self, request, pk):
        try:
            event = CalendarEvent.objects.select_related('employee').get(pk=pk)
        except CalendarEvent.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        serializer = CalendarEventSerializer(event, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True, 'event': serializer.data})

    def delete(self, request, pk):
        try:
            event = CalendarEvent.objects.get(pk=pk)
        except CalendarEvent.DoesNotExist:
            return Response({'ok': False, 'error': 'Not found'}, status=404)
        event.delete()
        return Response({'ok': True})


