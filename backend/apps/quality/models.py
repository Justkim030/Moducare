from django.db import models

class IncidentReport(models.Model):
	"""Model representing an incident report linked to an employee and a patient."""
	employee = models.ForeignKey(
		"users.Employee",
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="incident_reports",
	)
	patient = models.ForeignKey(
		"patients.Patient",
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="incident_reports",
	)
	incident_date = models.DateTimeField()
	incident_type = models.CharField(max_length=128)
	description = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = "Incident Report"
		verbose_name_plural = "Incident Reports"

	def __str__(self):
		return f"Incident {self.id} - {self.incident_type} ({self.incident_date.date()})"
