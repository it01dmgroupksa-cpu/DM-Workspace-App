import axios from 'axios';
import moment from 'moment';
import RNBlobUtil from 'react-native-blob-util';
import { OneDrive } from '@microsoft/microsoft-graph-client';
import { Workflow } from 'lucide-react';

const api = axios.create({
  baseURL: 'https://dmgroup.frappe.cloud/api/method',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add this function to clear the "Expect" header
const clearExpectHeader = config => {
  if (config && config.headers) {
    delete config.headers['Expect'];
  }
  return config;
};

// Attach an interceptor to remove the Expect header
api.interceptors.request.use(clearExpectHeader, error => Promise.reject(error));

export const login = async (email, password) => {
  try {
    console.log('Attempting to login with email:', email); // Log email
    
    const response = await api.post(
      'login',
      {
        usr: email,
        pwd: password,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    
    // Log the entire response for debugging
    console.log('Login response:', response.data); 
    
    // Check if response contains a 'Logged In' message
    const { message } = response.data;
    
    if (message === 'Logged In') {
      return response.data; // return the response data, you don't need the token
    } else {
      console.error('Unexpected response format:', response.data);
      return { message: 'Login Failed' };
    }
  } catch (error) {
    // Log error details for debugging
    if (error.response) {
      console.error('Login error response:', error.response.data);
    } else {
      console.error('Login error:', error.message);
    }
    throw error; // Re-throw the error to be handled in the calling function
  }
};


// Add Logout API
export const logout = async () => {
  try {
    const response = await api.post('logout');
    console.log('Logout response:', response.data);

    // Clear local storage (AsyncStorage) after logout
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userEmail');

    return response.data;
  } catch (error) {
    console.error('Error logging out:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Function to request leave
export const requestLeave = async leaveRequest => {
  try {
    const response = await api.post(
      '/frappe.client.insert',
      {
        doc: {
          doctype: 'Leave Application',
          ...leaveRequest,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Expect: '', // Ensure this is empty to avoid the 417 error
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error(
      'Error details:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

// Function to get leave requests
export const getLeaveRequests = async employeeID => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Leave Application',
        filters: JSON.stringify([['employee', '=', employeeID]]),
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

export const getEmployeeDetailsByUsername = async username => {
  try {
    const response = await api.get('/frappe.client.get_value', {
      params: {
        doctype: 'Employee',
        fieldname: '*',
        filters: JSON.stringify([['user_id', '=', username]]),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('employee details:', response.data.message);
    return response.data.message;
    
  } catch (error) {
    throw error;
  }
};

export const checkIn = async (employeeID, location, deviceID, imageLink) => {
  const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');
  console.log('latitude', location.latitude)
  console.log('longitude', location.longitude)
  try {
    const response = await api.post(
      '/frappe.client.insert',
      {
        doc: {
          doctype: 'Employee Checkin',
          employee: employeeID,
          log_type: 'IN',
          time: currentTime,
          custom_longitude: location.longitude,
          custom_latitude: location.latitude,
          location: `${location.latitude}, ${location.longitude}`,
          device_id: deviceID,
          custom_attendance_device: 'Mobile Device',
          image: imageLink,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    console.log('Check in successful:', response.data.message);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const checkOut = async (employeeID, location, deviceID, imageLink) => {
  const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');

  try {
    const response = await api.post(
      '/frappe.client.insert',
      {
        doc: {
          doctype: 'Employee Checkin',
          employee: employeeID,
          log_type: 'OUT',
          custom_longitude: location.longitude,
          custom_latitude: location.latitude,
          time: currentTime,
          location: `${location.latitude}, ${location.longitude}`,
          device_id: deviceID,
          custom_attendance_device: 'Mobile Device',
          image: imageLink,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const hasCheckedInToday = async employeeID => {
  const todayStart = moment().startOf('day').add(5, 'hours').format('YYYY-MM-DD HH:mm:ss');
  const tomorrowStart = moment().add(1, 'day').startOf('day').add(5, 'hours').format('YYYY-MM-DD HH:mm:ss');

  console.log('todayStart', todayStart);
  console.log('tomorrowStart', tomorrowStart);

  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee Checkin',
        fields: JSON.stringify(['name']),
        filters: JSON.stringify([
          ['employee', '=', employeeID],
          ['log_type', '=', 'IN'],
          ['time', '>=', todayStart],
          ['time', '<', tomorrowStart],
          ['custom_attendance_device', '=', 'Mobile Device']
        ]),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const checkIns = response.data.message;
    console.log('hasCheckedInToday', checkIns.length);

    return checkIns.length > 0;
  } catch (error) {
    throw error;
  }
};

export const hasCheckedOutToday = async employeeID => {
  const todayStart = moment().startOf('day').add(5, 'hours').format('YYYY-MM-DD HH:mm:ss');
  const tomorrowStart = moment().add(1, 'day').startOf('day').add(5, 'hours').format('YYYY-MM-DD HH:mm:ss');

  console.log('todayStart', todayStart);
  console.log('tomorrowStart', tomorrowStart);

  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee Checkin',
        fields: JSON.stringify(['name']),
        filters: JSON.stringify([
          ['employee', '=', employeeID],
          ['log_type', '=', 'OUT'],
          ['time', '>=', todayStart],
          ['time', '<', tomorrowStart],
          ['custom_attendance_device', '=', 'Mobile Device']
        ]),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const checkOuts = response.data.message;
    console.log('hasCheckedOutToday', checkOuts.length);

    return checkOuts.length > 0;
  } catch (error) {
    throw error;
  }
};

export const uploadImageToImgur = async (base64Image, fileName) => {
  const IMGUR_CLIENT_ID = '96c24c758d8b494';

  try {
    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        type: 'base64',
        name: fileName,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('Image uploaded successfully:', data.data.link);
      return data.data.link;
    } else {
      throw new Error(data.data.error);
    }
  } catch (error) {
    console.error('Error uploading image to Imgur:', error);
    throw error;
  }
};


export const getEmployeeDetails = async employeeID => {
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
export const requestQuotation = async quotationRequest => {
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
    console.error(
      'Error details:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

// Function to get quotations
export const getQuotations = async employeeID => {
  try {
    const response = await api.get(`/frappe.client.get_list`, {
      params: {
        doctype: 'Request for Quotation',
        filters: JSON.stringify([['employee', '=', employeeID]]),
        fields: '["name", "item_code", "quantity", "uom", "status"]',
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
        fields: '["item_code", "description"]',
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
          ['company', '=', 'Durar Masagh Trading Company'],
          ['is_group', '=', 0],
        ]),
        fields: '["warehouse_name", "name"]', // Ensure both fields are requested
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
      {value: 'RFQ-DM-.YYYY.-', label: 'RFQ-DM-.YYYY.-'},
      {value: 'RFQ-QM-.YYYY.-', label: 'RFQ-QM-.YYYY.-'},
      {value: 'RFQ-NS-.YYYY.-', label: 'RFQ-NS-.YYYY.-'},
    ];
    return seriesOptions;
  } catch (error) {
    throw error;
  }
};

export const getEmployeeAttendanceSettings = async employeeID => {
  try {
    console.log('Fetching employee attendance settings for:', employeeID);
    const response = await api.get('/frappe.client.get', {
      params: {
        doctype: 'Employee',
        name: employeeID,
        fields: JSON.stringify([
          'custom_outside_check_in',
          'custom_outside_check_out',
          'custom_all_location_attendance',
          'branch',
          'custom_job_location',
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
        fields: JSON.stringify([
          'branch',
          'branch_location',
          'custom_longitude',
          'custom_latitude',
        ]),
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
export const requestSalesPersonQuotation = async quotationRequest => {
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

export const submitSalesPersonRFQ = async rfq => {
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
    console.error(
      'Error submitting Sales Person RFQ:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

// Function to get Sales Person Quotations
export const getSalesPersonQuotations = async employeeID => {
  try {
    const response = await api.get(`/frappe.client.get_list`, {
      params: {
        doctype: 'Sales Person RFQ',
        filters: JSON.stringify([['employee', '=', employeeID]]),
        fields: '["name", "item_code", "quantity", "uom", "status"]',
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
        limit_page_length: 'None',
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

    return response.data.message;
  } catch (error) {
    console.error('Error fetching items:', error);
    throw error; // Ensure this propagates the error if it occurs
  }
};

// Attach an interceptor to remove the Expect header
api.interceptors.request.use(clearExpectHeader, error => Promise.reject(error));

export const getAllEmployees = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee',
        filters: JSON.stringify([
          ['custom_job_location', '!=', 'Work At Home'],
        ]),
        fields: JSON.stringify([
          'name',
          'employee_number',
          'employee_name',
          'department',
          'status',
          'branch',
          'custom_job_location',
        ]),
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
        Expect: '', // Ensure this is empty to avoid the 417 error
      },
    });
    return response.data.message;
  } catch (error) {
    console.error(
      'Error fetching employees:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

export const getEmployeesByDepartment = async department => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee',
        filters: JSON.stringify([
          ['department', '=', department],
          ['custom_job_location', '!=', 'Work At Home'],
        ]),
        fields: JSON.stringify([
          'name',
          'employee_number',
          'employee_name',
          'department',
          'status',
          'branch',
          'custom_job_location',
        ]),
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('Filtered Employees', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error(
      'Error fetching employees by department:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

export const searchEmployees = async query => {
  try {
    let filters = [];

    // Check if the query is a number or a string
    if (!isNaN(query)) {
      // If the query is a number, search by employee_number
      filters.push(['employee_number', 'like', `%${query}%`]);
    } else {
      // If the query is a string, search by employee_name
      filters.push(['employee_name', 'like', `%${query}%`]);
    }

    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee',
        filters: JSON.stringify(filters),
        fields: JSON.stringify([
          'name',
          'employee_number',
          'employee_name',
          'department',
          'status',
          'branch',
          'custom_job_location',
        ]),
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
export const getEmployeeById = async employeeId => {
  try {
    const response = await api.get(`/frappe.client.get`, {
      params: {
        doctype: 'Employee',
        name: employeeId,
        fields: JSON.stringify([
          'name',
          'employee_number',
          'employee_name',
          'department',
          'status',
          'branch',
          'custom_job_location',
        ]),
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
        fields: JSON.stringify([
          'name',
          'employee_number',
          'employee_name',
          'department',
          'status',
          'branch',
          'custom_job_location',
        ]),
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
        fields: JSON.stringify([
          'name',
          'employee',
          'task_category',
          'status',
          'last_updated_on',
        ]),
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
export const getTaskDetails = async taskId => {
  try {
    const response = await api.get('/frappe.client.get', {
      params: {
        doctype: 'Employee Task Management',
        name: taskId,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('getTaskDetails', response.data.message)
    return response.data.message;
  } catch (error) {
    console.error('Error fetching task details:', error);
    throw error;
  }
};

export const createTask = async taskData => {
  try {
    const formatDateTime = datetime => {
      const date = new Date(datetime);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const formattedTaskData = {
      doctype: 'Employee Task Management',
      employee: taskData.employee,
      task_category: taskData.task_category,
      status: taskData.status,
      employee_division: taskData.employee_division,
      branch: taskData.branch,
      date: taskData.date.toISOString().split('T')[0], // Format date as YYYY-MM-DD
      assigned_by: taskData.assigned_by,
      task_details: taskData.taskDetails.map(detail => ({
        description: detail.description,
        start_datetime: formatDateTime(detail.start_datetime),
        end_datetime: formatDateTime(detail.end_datetime),
        status: detail.status,
        hours_spent: detail.hours_spent,
        result: detail.result,
      })),
      customer: taskData.customer,
    };

    const response = await api.post(
      '/frappe.client.insert',
      {
        doc: formattedTaskData,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error(
      'Error creating task:',
      error.response ? error.response.data : error.message,
    );
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
export const deleteTask = async taskId => {
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
        fields: JSON.stringify(['task_category']), // Ensure these fields exist in your doctype
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error(
      'Error fetching task categories:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

export const getAssignedTasks = async current_user => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee Task Management',
        fields: JSON.stringify([
          'name',
          'employee',
          'task_category',
          'status',
          'date',
          'assigned_by',
          'employee_division',
          'branch'
        ]),
        filters: JSON.stringify([['employee', '=', current_user]]),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.data.message;
  } catch (error) {
    console.error('Error fetching assigned tasks:', error.response ? error.response.data : error.message);
    throw error;
  }
};
export const updateTaskDetail = async (taskId, detailId, updateData) => {
  try {
    console.log('Fetching current task details for taskId:', taskId);
    let currentTask = await getTaskDetails(taskId); // Fetch the current task details
    console.log('Current task details:', JSON.stringify(currentTask, null, 2));

    // Find the index of the task detail to update
    const detailIndex = currentTask.task_details.findIndex(detail => detail.name === detailId);
    if (detailIndex === -1) {
      throw new Error('Task detail not found');
    }

    // Update the task detail with the new data
    currentTask.task_details[detailIndex] = {
      ...currentTask.task_details[detailIndex],
      ...updateData,
    };

    console.log('Updated task details:', JSON.stringify(currentTask.task_details, null, 2));

    // First attempt to save with ignore_version: true
    console.log('Sending update request to API');
    const response = await saveTaskDetailsWithIgnoreVersion(currentTask, taskId);
    console.log('API response:', JSON.stringify(response.data, null, 2));
    return response.data;

  } catch (error) {
    // Check if the error is a timestamp mismatch error
    if (error.response?.data?.exc_type === 'TimestampMismatchError') {
      console.warn('Timestamp mismatch detected. Fetching latest version...');
      return handleTimestampMismatch(taskId, detailId, updateData);
    } else {
      console.error('Error updating task detail:', error);

      // Additional logging for 417 errors
      if (error.response?.status === 417) {
        console.error('Validation or API-specific issue:', error.response?.data);
        alert('There was a validation error. Please check that all required fields are filled and correctly formatted.');
      }

      console.error('Error response:', error.response ? JSON.stringify(error.response.data, null, 2) : 'No response data');
      throw error;
    }
  }
};

// Function to save the task details with ignore_version flag
const saveTaskDetailsWithIgnoreVersion = async (taskDetails, taskId) => {
  return await api.post('/frappe.client.save', {
    doc: {
      doctype: 'Employee Task Management',
      name: taskId,
      task_details: taskDetails.task_details,
    },
    ignore_version: true,  // Bypass timestamp check
  });
};

// Function to handle timestamp mismatch error
const handleTimestampMismatch = async (taskId, detailId, updateData) => {
  try {
    // Fetch the latest document after timestamp mismatch
    const latestTask = await getTaskDetails(taskId);
    console.log('Latest task details:', JSON.stringify(latestTask, null, 2));

    // Find the task detail to update in the latest fetched document
    const detailIndex = latestTask.task_details.findIndex(detail => detail.name === detailId);
    if (detailIndex === -1) {
      throw new Error('Task detail not found after fetching the latest version');
    }

    // Apply the updates to the latest task
    latestTask.task_details[detailIndex] = {
      ...latestTask.task_details[detailIndex],
      ...updateData,
    };

    console.log('Updated task details after re-fetch:', JSON.stringify(latestTask.task_details, null, 2));

    // Retry the update with the latest task details
    const response = await saveTaskDetailsWithIgnoreVersion(latestTask, taskId);
    console.log('API response after retry:', JSON.stringify(response.data, null, 2));
    return response.data;

  } catch (error) {
    console.error('Error retrying task detail update after timestamp mismatch:', error);

    // Logging and handling the 417 error
    if (error.response?.status === 417) {
      console.error('Failed with 417 status code:', error.response?.data);
      alert('Document update failed due to a validation error. Please ensure all required fields are correctly filled and retry.');
    }
    
    throw error;
  }
};


export const getTaskEmployeeDivision = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee Task Management',
        fields: JSON.stringify(['employee_division']), // Ensure these fields exist in your doctype
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error(
      'Error fetching task Employee Division:',
      error.response ? error.response.data : error.message,
    );
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
    console.error(
      'Error fetching task status:',
      error.response ? error.response.data : error.message,
    );
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
    console.error(
      'Failed to fetch branch locations:',
      error.response ? error.response.data : error.message,
    );
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
    console.error(
      'Failed to fetch branch locations:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

// Function to get user's RFQs with quotation details
export const getUserRFQs = async employeeID => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Sales Person RFQ',
        filters: JSON.stringify([['sales_person', '=', employeeID]]),
        fields: JSON.stringify([
          'name',
          'quotation_no',
          'customer_name',
          'date',
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
    console.error(
      'Error fetching user RFQs:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

export const downloadQuotationPDF = async quotationNo => {
  const url = `https://dmgroup.frappe.cloud/api/method/frappe.utils.print_format.download_pdf?doctype=Quotation&name=${quotationNo}&format=Quotation%20-%20DM&no_letterhead=0`;

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
        description: 'Downloading quotation PDF',
      },
    }).fetch('GET', url, {
      // Add any necessary headers here
      // 'Authorization': `Bearer ${api.defaults.headers.common['Authorization']}`,
    });

    console.log('The file saved to ', res.path());
    return {success: true, path: res.path()};
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
};

export const getSalesPersonNameByEmployeeID = async employeeID => {
  try {
    console.log('employeeID:',employeeID)
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Sales Person',
        filters: JSON.stringify([['employee', '=', employeeID]]),
        fields: JSON.stringify(['name', 'sales_person_name']),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('SalesPersonNameDetails:', response.data.message);
    if (response.data.message.length > 0) {
      console.log(
        'SalesPersonName:',
        response.data.message[0].sales_person_name,
      );
      return response.data.message[0].sales_person_name;
    } else {
      console.warn('No sales person found for this employee ID');
      return null;
    }
  } catch (error) {
    console.error(
      'Error fetching sales person by employee ID:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

// Function to get employee RFQ permissions from the Employee doctype
export const getEmployeePermissions = async employeeID => {
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
          'custom_allow_app',
        ]),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Employee npermission:', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error(
      'Error fetching employee permissions:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

// API functions
export const getAllItems = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Item',
        fields: JSON.stringify([
          'name',
          'item_code',
          'item_name',
        ]),
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
        Expect: '',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching items:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const getItemStockByWarehouse = async (itemCode) => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Bin',
        filters: JSON.stringify([['item_code', '=', itemCode]]),
        fields: JSON.stringify([
          'warehouse',
          'actual_qty',
          'stock_uom',
        ]),
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
        Expect: '',
      },
    });
    return response.data.message.map(item => ({
      warehouse: item.warehouse,
      stock_qty: item.actual_qty,
      stock_uom: item.stock_uom,
    }));
  } catch (error) {
    console.error('Error fetching item stock by warehouse:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const searchItems = async (query) => {
  try {
    let filters = [];

    // Check if the query is a number or a string
    if (!isNaN(query)) {
      // If the query is a number, search by item_code
      filters.push(['item_code', 'like', `%${query}%`]);
    } else {
      // If the query is a string, search by item_name and brand
      filters.push(['item_name', 'like', `%${query}%`]);
    }

    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Item',
        filters: JSON.stringify(filters),
        fields: JSON.stringify([
          'name',
          'item_code',
          'item_name',
        ]),
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
        Expect: '',
      },
    });

    return response.data.message;
  } catch (error) {
    console.error('Error searching items:', error.response ? error.response.data : error.message);
    throw error;
  }
};
export const getUnpaidOverdueInvoices = async (salesPersonName) => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Sales Invoice',
        filters: JSON.stringify([
          ['status', 'in', ['Unpaid', 'Overdue']], 
          ['sales_person', '=', salesPersonName],  
        ]),
        fields: JSON.stringify([
          'name',
          'customer',   
          'outstanding_amount',  
          'posting_date', 
          'status',           // Status (Unpaid or Overdue)
          'total',            // Total Invoice Amount
        ]),
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('getUnpaidOverdueInvoices', response.data.message)
    return response.data.message;
  } catch (error) {
    console.error('Error fetching unpaid or overdue invoices:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const searchInvoicesByCustomer = async (salesPersonName, customerQuery) => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Sales Invoice',
        filters: JSON.stringify([
          ['status', 'in', ['Unpaid', 'Overdue']], 
          ['sales_person', '=', salesPersonName],   
          ['customer', 'like', `%${customerQuery}%`], 
        ]),
        fields: JSON.stringify([
          'name',
          'customer',
          'outstanding_amount',
          'posting_date',
          'status',           // Status (Unpaid or Overdue)
          'total',            // Total Invoice Amount
          'items',            // Items in the invoice
        ]),
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('searchInvoicesByCustomer', response.data.message)
    return response.data.message;
  } catch (error) {
    console.error('Error searching invoices:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const getInvoiceDetails = async (invoiceID) => {
  try {
    const response = await api.get('/frappe.client.get', {
      params: {
        doctype: 'Sales Invoice',
        name: invoiceID,  // Invoice ID
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching invoice details:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const createMaterialsRequest = async requestData => {
  try {
    const formatDate = date => {
      return date instanceof Date ? date.toISOString().split('T')[0] : date;
    };

    const formattedRequestData = {
      doctype: 'Materials Service General Request Form',
      date: formatDate(requestData.date),
      employee: requestData.employee,
      department: requestData.department,
      branch: requestData.branch,
      request_type: requestData.request_type,
      description_req: requestData.description_req,
      item_details: requestData.item_details.map(item => ({
        item_name: item.item_name,
        item_description: item.item_description,
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit,
        price: parseFloat(item.price) || 0,
        currency: item.currency,
        total: parseFloat(item.total) || 0,
      })),
      total_amount: parseFloat(requestData.total_amount) || 0,
      Workflow_state: 'Pending Review',
    };

    const response = await api.post(
      '/frappe.client.insert',
      {
        doc: formattedRequestData,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error(
      'Error creating materials request:',
      error.response ? error.response.data : error.message,
    );
    throw new Error('Failed to create materials request. Please try again.');
  }
};

export const getRequestTypes = async () => {
  try {
    const response = await api.get('/frappe.desk.form.load.getdoctype', {
      params: {
        doctype: 'Materials Service General Request Form',
      },
    });

    // Find the field with fieldname 'request_type' and extract its options
    const requestTypeField = response.data.docs[0].fields.find(field => field.fieldname === 'request_type');
    
    if (requestTypeField && requestTypeField.fieldtype === 'Select') {
      // Split options string by newline to create an array of options
      const options = requestTypeField.options.split('\n');
      return options;
    } else {
      console.warn('Request type field not found or not a Select field');
      return [];
    }

  } catch (error) {
    console.error('Error fetching request types:', error.response ? error.response.data : error.message);
    return [];
  }
};

export const getDraftRequests = async (employeeName) => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Materials Service General Request Form',
        filters: JSON.stringify([
          ['employee', '=', employeeName],
          ['workflow_state', '=', 'Draft']
        ]),
        fields: ['name']
      }
    });

    const draftRequests = await Promise.all(
      response.data.message.map(async (request) => {
        const detailedResponse = await api.get('/frappe.client.get', {
          params: {
            doctype: 'Materials Service General Request Form',
            name: request.name
          }
        });
        return detailedResponse.data.message;
      })
    );

    console.log('getDraftRequests:', draftRequests);
    return draftRequests;
  } catch (error) {
    console.error('Error fetching draft requests:', error.response ? error.response.data : error.message);
    throw new Error('Failed to fetch draft requests. Please try again.');
  }
};

export const getSubmittedRequests = async (employeeName) => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Materials Service General Request Form',
        filters: JSON.stringify([
          ['employee', '=', employeeName],
          ['workflow_state', '!=', 'Draft']
        ]),
        fields: ['name']
      }
    });

    const submittedRequests = await Promise.all(
      response.data.message.map(async (request) => {
        const detailedResponse = await api.get('/frappe.client.get', {
          params: {
            doctype: 'Materials Service General Request Form',
            name: request.name
          }
        });
        return detailedResponse.data.message;
      })
    );

    console.log('getSubmittedRequests:', submittedRequests);
    return submittedRequests;
  } catch (error) {
    console.error('Error fetching submitted requests:', error.response ? error.response.data : error.message);
    return [];
  }
};

export const submitDraftRequest = async (requestId) => {
  try {
    // First, fetch the document
    const docResponse = await api.get('/frappe.client.get', {
      params: {
        doctype: 'Materials Service General Request Form',
        name: requestId
      }
    });
    
    const doc = docResponse.data.message;

    // Now submit the document
    const response = await api.post('/frappe.client.submit', {
      doctype: 'Materials Service General Request Form',
      name: requestId,
      doc: doc
    });
    console.log('SubmitDraftRequest:', response.data)
    return response.data;
  } catch (error) {
    console.error('Error submitting draft request:', error.response ? error.response.data : error.message);
    if (error.response && error.response.data && error.response.data.exception) {
      throw new Error(`Failed to submit draft request: ${error.response.data.exception}`);
    } else {
      throw new Error('Failed to submit draft request. Please try again.');
    }
  }
};

export const getDMOfficialMemos = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'DM Official Memo',
        filters: JSON.stringify([
          ['workflow_state', '=', 'Approved'],
          ['to_whome', 'like', '%all employees%']
        ]),
        fields: JSON.stringify([ 
          'name',
          'memo_date',
          'memo_to',
          'memo_subject',
          'memo_type',
          'memo_catagory',
          'memo_details',
          'memo_end',
          'issued_by'
        ]),
        order_by: 'memo_date desc',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('getDMOfficialMemos', response.data.message)
    return response.data.message;
  } catch (error) {
    console.error('Error fetching DM Official Memos:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const getDMOfficialMemoDetails = async (memoId) => {
  try {
    const response = await api.get('/frappe.client.get', {
      params: {
        doctype: 'DM Official Memo',
        name: memoId,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching DM Official Memo details:', error.response ? error.response.data : error.message);
    throw error;
  }
};


// Utility function to add delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to insert employee details and delay capturing the response
export const postPersonalEmployeeDetails = async (employeeName) => {
  try {
    // Insert employee data using POST request
    const postRequest = api.post('/frappe.client.insert', {
      doc: {
        doctype: 'Self-Service Employee Portal',
        employee: employeeName,
      }
    });

    // Wait for 2 seconds before capturing the response (to allow the backend to finish processing)
    await delay(2000);  // Add 2-second delay before reading the response

    // Now capture the response after the delay
    const insertResponse = await postRequest;
    console.log('Employee details posted:', insertResponse.data);

    // Return the final response after the delay
    return insertResponse.data;

  } catch (error) {
    console.error('Error posting employee details:', error.response ? error.response.data : error.message);
    throw error;
  }
};



export const getUnitOptions = async () => {
  try {
    const response = await api.get('/frappe.desk.form.load.getdoctype', {
      params: {
        doctype: 'Materials Service General Request Form',
      },
    });

    // Check if the response contains the fields and docs array
    const doc = response.data.docs[0];

    // Find the 'item_details' field which should be a table
    const itemDetailsField = doc.fields.find(field => field.fieldname === 'item_details');
    
    if (itemDetailsField && itemDetailsField.fieldtype === 'Table') {
      // Now find the child table doctype for 'item_details'
      const childTableDoctype = itemDetailsField.options;

      // Fetch the child table doctype to get the unit field
      const childResponse = await api.get('/frappe.desk.form.load.getdoctype', {
        params: {
          doctype: childTableDoctype,  // The child table's doctype
        },
      });

      // Find the 'unit' field within the child doctype's fields
      const unitField = childResponse.data.docs[0].fields.find(subField => subField.fieldname === 'unit');

      if (unitField && unitField.fieldtype === 'Select') {
        // Return the list of options after splitting by newline
        return unitField.options.split('\n');
      } else {
        console.warn('Unit field not found or not a Select field');
        return [];
      }
    } else {
      console.warn('Item details field not found or not a Table field');
      return [];
    }
  } catch (error) {
    console.error('Error fetching unit options:', error.response?.data || error.message);
    return [];
  }
};

export const getEmployeesWithChatAccess = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Employee',
        fields: JSON.stringify([
          'name',
          'employee_name',
          'user_id',
          'custom_allow_chat_module'
        ]),
        filters: JSON.stringify([
          ['custom_allow_chat_module', '=', 1]
        ]),
        limit_page_length: 'None',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.message;
  } catch (error) {
    console.error('Error fetching employees with chat access:', error);
    throw error;
  }
};

export const getAssignedDeliveryTrips = async (employeeName) => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Delivery Trip',
        fields: JSON.stringify([
          'name',
          'naming_series',
          'company',
          'email_notification_sent',
          'driver',
          'driver_name',
          'driver_email',
          'driver_address',
          'custom_driver_number',
          'delivery_status',
          'total_distance',
          'uom',
          'vehicle',
          'departure_time',
          'custom_delivered_time',
          'employee',
          'location_link',
          'amended_from',
          'status',
          'custom_source_warehouse'
        ]),
        filters: JSON.stringify([
          ['employee', '=', employeeName],
          ['status', '=', 'Draft'],
        ]),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('getAssignedDeliveryTrips', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Error fetching assigned delivery trips:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const getDeliveryStops = async (tripId) => {
  try {
    const response = await api.get('/frappe.client.get', {
      params: {
        doctype: 'Delivery Trip',
        name: tripId,
        fields: JSON.stringify(['delivery_stops']),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('getDeliveryStops', response.data.message.delivery_stops);
    return response.data.message.delivery_stops;
  } catch (error) {
    console.error('Error fetching delivery stops:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const updateSignedDeliveryNotes = async (tripId, imageUrls) => {
  try {
    const response = await api.put('/frappe.client.set_value', {
      doctype: 'Delivery Trip',
      name: tripId,
      fieldname: {
        custom_signed_delivery_note: imageUrls[0] || '',
        custom_attach_2: imageUrls[1] || '',
        custom_attach_3: imageUrls[2] || '',
        custom_attach_4: imageUrls[3] || '',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error updating signed delivery notes:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const updateDeliveryTripStatus = async (tripId, status) => {
  try {
    const response = await api.put('/frappe.client.set_value', {
      doctype: 'Delivery Trip',
      name: tripId,
      fieldname: 'delivery_status',
      value: status,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating delivery trip status:',error.response ? error.response.data : error.message);
    throw error;
  }
};

export const updateCustomDeliveredTime = async (tripId, deliveredTime) => {
  try {
    // Format the datetime to 'YYYY-MM-DD HH:mm:ss'
    const formattedTime = moment(deliveredTime).format('YYYY-MM-DD HH:mm:ss');
    
    const response = await api.put('/frappe.client.set_value', {
      doctype: 'Delivery Trip',
      name: tripId,
      fieldname: 'custom_delivered_time',
      value: formattedTime,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating custom delivered time:', error);
    throw error;
  }
};

export const  getAllEmployeesDir= async () => {
  try {
    // Step 1: Get the specific document name (we already know it in this case)
    const docName = "Durar Masagh Trading Company";

    // Step 2: Fetch the full document with its child table
    const response = await api.get('/frappe.client.get', {
      params: {
        doctype: 'Employee Directory',
        name: docName,
        fields: '["*"]'  // This fetches all fields, including child tables
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Employee Directory Details:', response.data.message);
    return response.data.message;
  } catch (error) {
    console.error('Error fetching employee directory details:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const getEmployeeByIdDir = async (employeeId) => {
  try {
    // Step 1: Fetch the main Employee Directory document
    const docName = "Durar Masagh Trading Company"; // The parent document name

    const response = await api.get('/frappe.client.get', {
      params: {
        doctype: 'Employee Directory',
        name: docName,
        fields: '["employee_details"]', // Fetch only the child table
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Step 2: Find the specific employee by employee_id inside the child table
    const employeeDetails = response.data.message.employee_details;
    const employee = employeeDetails.find(emp => emp.employee_id === employeeId);

    if (!employee) {
      console.warn(`Employee with ID ${employeeId} not found.`);
      return null;
    }

    console.log(`Employee Details for ID ${employeeId}:`, employee);
    return employee;
  } catch (error) {
    console.error('Error fetching employee details:', error.response ? error.response.data : error.message);
    throw error;
  }
};
