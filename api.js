import axios from 'axios';
import moment from 'moment';
import RNBlobUtil from 'react-native-blob-util';

const api = axios.create({
  baseURL: 'https://dmgroup.frappe.cloud/api/method',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add this function to clear the "Expect" header
const clearExpectHeader = (config) => {
  if (config && config.headers) {
    delete config.headers['Expect'];
  }
  return config;
};

// Attach an interceptor to remove the Expect header
api.interceptors.request.use(clearExpectHeader, (error) => Promise.reject(error));

// Function to request leave
export const requestLeave = async (leaveRequest) => {
  try {
    const response = await api.post('/frappe.client.insert', {
      doc: {
        doctype: 'Leave Application',
        ...leaveRequest,
      },
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Expect': '',  // Ensure this is empty to avoid the 417 error
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error details:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Function to get leave requests
export const getLeaveRequests = async (employeeID) => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Leave Application',
        filters: JSON.stringify([["employee", "=", employeeID]]),
        fields: '["name", "leave_type", "status", "total_leave_days"]',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    throw error;
  }
};

// Other existing functions...

const handleLogin = async () => {
  try {
    console.log('Attempting to login with email:', email); // Log email
    const response = await login(email, password);
    console.log('Login response:', response); // Log the response

    if (response.message === 'Logged In') {
      const employeeDetails = await getEmployeeDetailsByUsername(email);
      console.log('Fetched employee details:', employeeDetails);
      setEmployeeDetails(employeeDetails);
      console.log('Navigating to AttendanceManagement');
      navigation.navigate('AttendanceManagement');
    } else {
      Alert.alert('Login Failed', 'Invalid email or password');
    }
  } catch (error) {
    if (error.response) {
      console.error('Login error response:', error.response.data); // Log the error response data
    } else {
      console.error('Login error:', error.message); // Log the error message
    }
    Alert.alert('Login Failed', 'Invalid email or password');
  }
};

export const login = async (email, password) => {
  try {
    console.log('Attempting to login with email:', email); // Log email
    const response = await api.post('login', {
      usr: email,
      pwd: password,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('Login response:', response.data); // Log the response
    const { token } = response.data;
    api.defaults.headers.common['Authorization'] = `token ${token}`;
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Login error response:', error.response.data); // Log the error response data
    } else {
      console.error('Login error:', error.message); // Log the error message
    }
    Alert.alert('Login Failed', 'Invalid email or password');
    throw error;
  }
};

export const getEmployeeDetailsByUsername = async (username) => {
  try {
    const response = await api.get('/frappe.client.get_value', {
      params: {
        doctype: 'Employee',
        fieldname: '*',
        filters: JSON.stringify([["user_id", "=", username]]),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    throw error;
  }
};

export const checkIn = async (employeeID, location, deviceID) => {
  const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');

  try {
    const response = await api.post('/frappe.client.insert', {
      doc: {
        doctype: 'Employee Checkin',
        employee: employeeID,
        log_type: 'IN',
        time: currentTime,
        custom_longitude: location.latitude,
        custom_latitude: location.longitude,
        location: `${location.latitude}, ${location.longitude}`,
        device_id: deviceID,
        custom_attendance_device: 'Mobile Device',
      },
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Check in successful:', response.data.message);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const checkOut = async (employeeID, location, deviceID) => {
  const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');

  try {
    const response = await api.post('/frappe.client.insert', {
      doc: {
        doctype: 'Employee Checkin',
        employee: employeeID,
        log_type: 'OUT',
        custom_longitude: location.latitude,
        custom_latitude: location.longitude,
        time: currentTime,
        location: `${location.latitude}, ${location.longitude}`,
        device_id: deviceID,
        custom_attendance_device: 'Mobile Device',
      },
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getEmployeeDetails = async (employeeID) => {
  try {
    const response = await api.get(`/resource/Employee/${employeeID}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Function to request a quotation
export const requestQuotation = async (quotationRequest) => {
  try {
    const response = await api.post('/frappe.client.insert', {
      doc: {
        doctype: 'Request for Quotation',
        ...quotationRequest,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error details:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Function to get quotations
export const getQuotations = async (employeeID) => {
  try {
    const response = await api.get(`/frappe.client.get_list`, {
      params: {
        doctype: 'Request for Quotation',
        filters: JSON.stringify([["employee", "=", employeeID]]),
        fields: '["name", "item_code", "quantity", "uom", "status"]'
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    throw error;
  }
};

// Function to get suppliers
export const getSuppliers = async () => {
  try {
    const response = await api.get(`/frappe.client.get_list`, {
      params: {
        doctype: 'Supplier',
        fields: '["name", "supplier_name"]',
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    throw error;
  }
};

// Function to get items
export const getItems = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Item',
        fields: '["item_code", "description"]'
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    throw error;
  }
};

// Function to get UOMs
export const getUOMs = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'UOM',
        fields: '["uom_name"]',
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    throw error;
  }
};

export const getWarehouses = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Warehouse',
        limit_page_length: 'None',
        filters: JSON.stringify([
          ["company", "=", "Durar Masagh Trading Company"],
          ["is_group", "=", 0]
        ]),
        fields: '["warehouse_name", "name"]'  // Ensure both fields are requested
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('Fetched Warehouses:', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    throw error;
  }
};


// Function to get series options
export const getSeriesOptions = async () => {
  try {
    const seriesOptions = [
      { value: 'RFQ-DM-.YYYY.-', label: 'RFQ-DM-.YYYY.-' },
      { value: 'RFQ-QM-.YYYY.-', label: 'RFQ-QM-.YYYY.-' },
      { value: 'RFQ-NS-.YYYY.-', label: 'RFQ-NS-.YYYY.-' },
    ];
    return seriesOptions;
  } catch (error) {
    throw error;
  }
};

export const getEmployeeAttendanceSettings = async (employeeID) => {
  try {
    console.log('Fetching employee attendance settings for:', employeeID);
    const response = await api.get('/frappe.client.get', {
      params: {
        doctype: 'Employee',
        name: employeeID,
        fields: JSON.stringify([
          "custom_outside_check_in",
          "custom_outside_check_out",
          "custom_all_location_attendance",
          "branch",
          "custom_job_location",
        ]),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('Employee attendance settings:', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Error fetching attendance settings:', error);
    throw error;
  }
};

// Function to get branch locations
export const getBranchLocations = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Branches GPS Location',
        fields: JSON.stringify(["branch", "branch_location", "custom_longitude", "custom_latitude"]),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    }); 
    console.log('Branches:', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Failed to fetch branch locations:', error);
    throw error;
  }
};

// Function to request Sales Person Quotation
export const requestSalesPersonQuotation = async (quotationRequest) => {
  try {
    const response = await api.post('/frappe.client.insert', {
      doc: {
        doctype: 'Sales Person RFQ',
        ...quotationRequest,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const submitSalesPersonRFQ = async (rfq) => {
  try {
    const response = await api.post('/frappe.client.insert', {
      doc: {
        doctype: 'Sales Person RFQ',
        ...rfq,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting Sales Person RFQ:', error.response ? error.response.data : error.message);
    throw error;
  }
};



// Function to get Sales Person Quotations
export const getSalesPersonQuotations = async (employeeID) => {
  try {
    const response = await api.get(`/frappe.client.get_list`, {
      params: {
        doctype: 'Sales Person RFQ',
        filters: JSON.stringify([["employee", "=", employeeID]]),
        fields: '["name", "item_code", "quantity", "uom", "status"]'
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    throw error;
  }
};

// Function to get customers
export const getCustomers = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Customer',
        fields: '["name", "customer_name"]',
        limit_page_length: 'None'
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
};

export const getItemsList = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Item',
        fields: '["name", "item_code", "item_name"]', 
        limit_page_length: 'None', 
      },
    });
    console.log('Items List:', response.data.message);  // Log to see the data structure
    return response.data.message;
  } catch (error) {
    console.error('Error fetching items:', error);
    throw error;  // Ensure this propagates the error if it occurs
  }
};

// Attach an interceptor to remove the Expect header
api.interceptors.request.use(clearExpectHeader, (error) => Promise.reject(error));

export const getAllEmployees = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee',
        filters: JSON.stringify([
          ["custom_job_location", "!=", "Work At Home"]
        ]),
        fields: JSON.stringify(['name', 'employee_number', 'employee_name', 'department', 'status', 'branch', 'custom_job_location']),
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
        'Expect': ''  // Ensure this is empty to avoid the 417 error
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching employees:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const getEmployeesByDepartment = async (department) => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee',
        filters: JSON.stringify([
          ["department", "=", department],
          ["custom_job_location", "!=", "Work At Home"]
        ]),
        fields: JSON.stringify(['name', 'employee_number', 'employee_name', 'department', 'status', 'branch', 'custom_job_location']),
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('Filtered Employees', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Error fetching employees by department:', error.response ? error.response.data : error.message);
    throw error;
  }
};


export const searchEmployees = async (query) => {
  try {
    let filters = [];

    // Check if the query is a number or a string
    if (!isNaN(query)) {
      // If the query is a number, search by employee_number
      filters.push(["employee_number", "like", `%${query}%`]);
    } else {
      // If the query is a string, search by employee_name
      filters.push(["employee_name", "like", `%${query}%`]);
    }

    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee',
        filters: JSON.stringify(filters),
        fields: JSON.stringify(['name', 'employee_number', 'employee_name', 'department', 'status', 'branch', 'custom_job_location']),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Filtered Employees', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Error searching employees:', error);
    throw error;
  }
};


// Function to fetch employee details by ID
export const getEmployeeById = async (employeeId) => {
  try {
    const response = await api.get(`/frappe.client.get`, {
      params: {
        doctype: 'Employee',
        name: employeeId,
        fields: JSON.stringify(['name', 'employee_number', 'employee_name', 'department', 'status', 'branch', 'custom_job_location']),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching employee details:', error);
    throw error;
  }
};

// Function to sort employees
export const sortEmployees = async (sortBy, sortOrder) => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee',
        order_by: `${sortBy} ${sortOrder}`,
        fields: JSON.stringify(['name', 'employee_number', 'employee_name', 'department', 'status', 'branch', 'custom_job_location']),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error sorting employees:', error);
    throw error;
  }
};

export const getDepartments = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Department',
        fields: JSON.stringify(['name']),
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching departments:', error);
    throw error;
  }
};

// Function to get all tasks
export const getAllTasks = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee Task Management', // Replace with your actual doctype name
        fields: JSON.stringify(['name', 'employee', 'task_category', 'status', 'last_updated_on']),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
};

// Function to get task details by ID
export const getTaskDetails = async (taskId) => {
  try {
    const response = await api.get('/frappe.client.get', {
      params: {
        doctype: 'Employee Task Management', // Replace with your actual doctype name
        name: taskId,
        fields: JSON.stringify(['name', 'employee', 'task_category', 'status', 'description', 'start_datetime', 'end_datetime']),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching task details:', error);
    throw error;
  }
};

// Function to create a new task
export const createTask = async (taskData) => {
  try {
    const response = await api.post('/frappe.client.insert', {
      doc: {
        doctype: 'Employee Task Management', // Replace with your actual doctype name
        ...taskData,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
};

// Function to update a task
export const updateTask = async (taskId, taskData) => {
  try {
    const response = await api.put('/frappe.client.update', {
      doc: {
        doctype: 'Employee Task Management', // Replace with your actual doctype name
        name: taskId,
        ...taskData,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

// Function to delete a task
export const deleteTask = async (taskId) => {
  try {
    const response = await api.delete('/frappe.client.delete', {
      params: {
        doctype: 'Employee Task Management', // Replace with your actual doctype name
        name: taskId,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

export const getTaskCategories = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee Task Management',
        fields: JSON.stringify(['task_category']),  // Ensure these fields exist in your doctype
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching task categories:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const getTaskEmployeeDivision = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee Task Management',
        fields: JSON.stringify(['employee_division']),  // Ensure these fields exist in your doctype
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching task Employee Division:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const getTaskStatus = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee Task Management',
        fields: JSON.stringify(['status']),  
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('Status Details:', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Error fetching task status:', error.response ? error.response.data : error.message);
    throw error;
  }
};


// Function to get branches
export const getBranches = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Branch',
        fields: JSON.stringify(['branch']),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    }); 
    console.log('Branches Details:', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Failed to fetch branch locations:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Function to get branches
export const getRFQBranches = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Sales Person RFQ',
        fields: JSON.stringify(['branch']),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    }); 
    console.log('Branches Details:', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Failed to fetch branch locations:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Function to get user's RFQs with quotation details
export const getUserRFQs = async (employeeID) => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Sales Person RFQ',
        filters: JSON.stringify([["sales_person", "=", employeeID]]),
        fields: JSON.stringify([
          "name", 
          "quotation_no", 
          "customer_name", 
          "date"
        ]),
        order_by: 'creation desc',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('User RFQs:', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Error fetching user RFQs:',  error.response ? error.response.data : error.message);
    throw error;
  }
};

export const downloadQuotationPDF = async (quotationNo) => {
  const url = `https://dmgroup.frappe.cloud/api/method/frappe.utils.print_format.download_pdf?doctype=Quotation&name=${quotationNo}&format=Standard&no_letterhead=0`;

  try {
    const res = await RNBlobUtil.config({
      fileCache: true,
      appendExt: 'pdf',
      path: RNBlobUtil.fs.dirs.DocumentDir + `/quotation_${quotationNo}.pdf`,
      addAndroidDownloads: {
        useDownloadManager: true,
        notification: true,
        title: `${quotationNo}.pdf`,
        mime: 'application/pdf',
        description: 'Downloading quotation PDF'
      }
    }).fetch('GET', url, {
      // Add any necessary headers here
      // 'Authorization': `Bearer ${api.defaults.headers.common['Authorization']}`,
    });

    console.log('The file saved to ', res.path());
    return { success: true, path: res.path() };
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
};

export const getSalesPersonStatus = async (employeeID) => {
  try {
    const response = await api.get('/frappe.client.get', {
      params: {
        doctype: 'Sales Person',
        filters: JSON.stringify([['employee', '=', employeeID]]),
        fields: JSON.stringify(['enabled']),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('SalesPersonStatus:', response.data.message);
    return response.data.message.enabled;  // Returning the 'enabled' field value
  } catch (error) {
    console.error('Error fetching Sales Person status:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const getSalesPersonNameByEmployeeID = async (employeeID) => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Sales Person',
        filters: JSON.stringify([["employee", "=", employeeID]]),
        fields: JSON.stringify(["name", "sales_person_name"]),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.data.message.length > 0) {
      console.log('SalesPersonName:', response.data.message[0].sales_person_name);
      return response.data.message[0].sales_person_name;
    } else {
      console.warn('No sales person found for this employee ID');
      return null;
    }
  } catch (error) {
    console.error('Error fetching sales person by employee ID:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Function to get employee RFQ permissions from the Employee doctype
export const getEmployeePermissions = async (employeeID) => {
  try {
    const response = await axios.get('/frappe.client.get', {
      params: {
        doctype: 'Employee',
        employee: employeeID,
        fields: JSON.stringify([
          'custom_allow_purchase_rfq',
          'custom_allow_sales_rfq',
          'custom_allow_leave_management',
          'custom_allow_task_management',
          'custom_allow_attendance',
          'custom_allow_app'
        ])
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Employee npermission:', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Error fetching employee permissions:', error.response ? error.response.data : error.message);
    throw error;
  }
};