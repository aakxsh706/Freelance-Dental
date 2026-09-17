"""Check that the configured mail settings can actually deliver.

Worth having as its own command: the alternative is booking a real
appointment to test credentials, which leaves junk in the database and emails
whoever the booking names.
"""

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand, CommandError

from clinic.models import ClinicSettings
from clinic.notifications import delivery_is_real


class Command(BaseCommand):
    help = "Send a test email to confirm the EMAIL_* settings work."

    def add_arguments(self, parser):
        parser.add_argument("recipient", help="Address to send the test to.")

    def handle(self, *args, **options):
        recipient = options["recipient"]
        clinic = ClinicSettings.load()

        self.stdout.write("Current mail configuration:")
        self.stdout.write(f"  EMAIL_BACKEND   {settings.EMAIL_BACKEND}")
        self.stdout.write(f"  EMAIL_HOST      {settings.EMAIL_HOST or '(unset)'}:{settings.EMAIL_PORT}")
        self.stdout.write(f"  EMAIL_HOST_USER {settings.EMAIL_HOST_USER or '(unset)'}")
        self.stdout.write(f"  DEFAULT_FROM    {settings.DEFAULT_FROM_EMAIL}")
        self.stdout.write("")

        if not delivery_is_real():
            self.stdout.write(
                self.style.WARNING(
                    "This backend does not deliver mail - it prints or discards it.\n"
                    "Nothing will arrive in an inbox. To send for real, set in backend/.env:\n"
                    "  EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend\n"
                    "  EMAIL_HOST_USER=<your address>\n"
                    "  EMAIL_HOST_PASSWORD=<app password>\n"
                    "then restart the backend.\n"
                )
            )

        if delivery_is_real() and not settings.EMAIL_HOST_USER:
            raise CommandError(
                "EMAIL_BACKEND is set to SMTP but EMAIL_HOST_USER is empty. "
                "Fill in EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in backend/.env."
            )

        message = EmailMultiAlternatives(
            subject=f"Test email from {clinic.clinic_name}",
            body=(
                f"This is a test message from {clinic.clinic_name}.\n\n"
                "If you are reading this in an inbox, appointment confirmation "
                "emails will reach patients correctly.\n"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
        )
        try:
            message.send(fail_silently=False)
        except Exception as exc:
            # The common Gmail failures are specific and worth naming, because
            # "SMTPAuthenticationError" on its own sends people to the wrong fix.
            hint = ""
            text = str(exc)
            if "Username and Password not accepted" in text or "BadCredentials" in text:
                hint = (
                    "\nGmail rejected the credentials. An ordinary account password "
                    "does not work: create an App Password at "
                    "https://myaccount.google.com/apppasswords (2-Step Verification "
                    "must be on) and use that as EMAIL_HOST_PASSWORD."
                )
            elif "Connection refused" in text or "timed out" in text:
                hint = (
                    "\nCould not reach the mail server. Check EMAIL_HOST and EMAIL_PORT, "
                    "and that the network allows outbound SMTP."
                )
            raise CommandError(f"Sending failed: {exc}{hint}") from exc

        if delivery_is_real():
            self.stdout.write(
                self.style.SUCCESS(f"Test email sent to {recipient}. Check the inbox and spam folder.")
            )
        else:
            self.stdout.write(
                self.style.SUCCESS("Message rendered and printed above - not delivered.")
            )
