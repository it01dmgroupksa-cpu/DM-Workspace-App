# ERP Server Script: keeps the app's Employee Directory in step with the real Employee
# records. The app's Directory tab reads ONE document, "Employee Directory" /
# "Durar Masagh Trading Company" (api.js getAllEmployeesDir), whose child table
# employee_details is a copy of each employee's public fields. Nothing updated that copy,
# so new joiners, leavers and changed phone numbers never reached the app.
#
# This rebuilds the copy from every Active employee. Paste the same code twice:
#
#   1) Server Script > New
#        Script Type:      Scheduler Event
#        Event Frequency:  Hourly
#      (a safety net: catches anything the second one misses)
#
#   2) Server Script > New
#        Script Type:      DocType Event
#        Reference DocType: Employee
#        DocType Event:    After Save
#      (instant: any employee change shows in the app at once)
#
# To fill the directory right away, open any Employee and press Save.
# Server Scripts must be enabled on the site (System Settings / site config
# "server_script_enabled": true).
#
# Only public work details are copied: ID, name, job location, company phone, company
# email. Nothing personal (salary, address, ID numbers) goes into the directory.

DIRECTORY = "Durar Masagh Trading Company"
# Only employees of one company? Put its exact name here; None lists every company's
# active employees.
COMPANY = None

filters = {"status": "Active"}
if COMPANY:
    filters["company"] = COMPANY

employees = frappe.get_all(
    "Employee",
    filters=filters,
    fields=["name", "employee_name", "custom_job_location", "cell_number", "company_email", "status"],
    order_by="employee_name asc",
    limit_page_length=0,
)

directory = frappe.get_doc("Employee Directory", DIRECTORY)
directory.set("employee_details", [])
for e in employees:
    directory.append(
        "employee_details",
        {
            "employee_id": e.name,
            "employee_name": e.employee_name,
            "custom_job_location": e.custom_job_location,
            "cell_number": e.cell_number,
            "company_email": e.company_email,
            "status": e.status,
        },
    )
directory.flags.ignore_permissions = True
directory.save()
