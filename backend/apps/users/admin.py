# apps/users/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django import forms
from .models import Names, Users, Employee

class CustomUserCreationForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput)

    class Meta:
        model = Users
        fields = ('username', 'employee_type', 'name')

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password"])
        if commit:
            user.save()
        return user

class UserAdmin(BaseUserAdmin):
    add_form = CustomUserCreationForm

    list_display = ('username', 'employee_type', 'is_staff', 'is_superuser')
    list_filter = ('is_staff', 'is_superuser', 'is_active')
    search_fields = ('username', 'employee_type')
    ordering = ('username',)

    # Cleaned up to match your exact AbstractBaseUser fields
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal Info', {'fields': ('name', 'employee_type')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
        ('Important dates', {'fields': ('last_login',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password', 'employee_type', 'name'),
        }),
    )
    
    readonly_fields = ('last_login',)

admin.site.register(Names)
admin.site.register(Users, UserAdmin)
admin.site.register(Employee)