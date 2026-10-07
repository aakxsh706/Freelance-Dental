from rest_framework import serializers

from ..models import AuditLog, StaffProfile


class AuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    patient_code = serializers.CharField(
        source="patient.patient_code", read_only=True, default=None
    )
    patient_name = serializers.CharField(
        source="patient.full_name", read_only=True, default=None
    )

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "username",
            "action",
            "action_display",
            "model_name",
            "object_id",
            "object_repr",
            "patient_code",
            "patient_name",
            "changes",
            "ip_address",
            "timestamp",
        ]
        read_only_fields = fields


class StaffProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    # Capability flags travel with the profile so the interface can hide what a
    # role cannot do, instead of offering an action that will 403 on click.
    can_view_clinical = serializers.BooleanField(read_only=True)
    can_edit_clinical = serializers.BooleanField(read_only=True)
    can_prescribe = serializers.BooleanField(read_only=True)
    can_manage_settings = serializers.BooleanField(read_only=True)
    can_view_audit = serializers.BooleanField(read_only=True)

    class Meta:
        model = StaffProfile
        fields = [
            "id",
            "username",
            "full_name",
            "role",
            "role_display",
            "phone",
            "is_active",
            "can_view_clinical",
            "can_edit_clinical",
            "can_prescribe",
            "can_manage_settings",
            "can_view_audit",
        ]
        read_only_fields = ["id", "username"]
