# ERP Server Script for the DM Workspace app: reports, blocks and account deletion
# requests (App Store guidelines 1.2 and 5.1.1(v)).
#
# Paste into ERP: Server Script > New
#   Script Type:  API
#   API Method:   dm_app_report
#   Allow Guest:  unticked (only signed-in employees)
# Setup and the "DM App Report" doctype: MESSENGER.md, "Reports, blocking and account
# deletion".

TYPES = ("Message", "User", "Block", "Account Deletion")
args = frappe.form_dict
user = frappe.session.user
if user == "Guest":
    frappe.throw("Sign in first.", frappe.PermissionError)

kind = args.get("type")
if kind not in TYPES:
    frappe.throw("Unknown report type.")

# Only the employee linked to the signed-in user, whatever the app sent.
employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
reported = (args.get("reported_user") or "").strip()[:140]
if kind != "Account Deletion" and not reported:
    frappe.throw("Who is being reported is missing.")
if reported and reported == user:
    frappe.throw("You can't report yourself.")


def text(name, size):
    return (args.get(name) or "").strip()[:size]


doc = frappe.get_doc({
    "doctype": "DM App Report",
    "report_type": kind,
    "status": "Open",
    "reported_by": user,
    "employee": employee,
    "reported_user": reported,
    "reported_employee": frappe.db.get_value("Employee", {"user_id": reported}, "name") if reported else None,
    "conversation": text("conversation", 140),
    "message_id": text("message_id", 140),
    "message_text": text("message_text", 2000),
    "reason": text("reason", 140),
    "details": text("details", 2000),
    "source": text("source", 40),
})
doc.insert(ignore_permissions=True)
frappe.response["message"] = {"name": doc.name}
