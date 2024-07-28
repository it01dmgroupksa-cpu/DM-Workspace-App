import axios from 'axios';
import moment from 'moment';

const api = axios.create({
  baseURL: 'https://dmg-v14.frappe.cloud/api/method',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export const login = async (email, password) => {
  try {
    const response = await api.post('login', {
      usr: email,
      pwd: password,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const { token } = response.data;
    api.defaults.headers.common['Authorization'] = `token ${token}`;
    return response.data;
  } catch (error) {
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

export const checkIn = async (employeeID, location) => {
  const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');

  try {
    const response = await api.post('/frappe.client.insert', {
      doc: {
        doctype: 'Employee Checkin',
        employee: employeeID,
        log_type: 'IN',
        time: currentTime,
        location: `${location.latitude}, ${location.longitude}`,
        device_id: 'Field Staff',
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

export const checkOut = async (employeeID, location) => {
  const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');

  try {
    const response = await api.post('/frappe.client.insert', {
      doc: {
        doctype: 'Employee Checkin',
        employee: employeeID,
        log_type: 'OUT',
        time: currentTime,
        location: `${location.latitude}, ${location.longitude}`,
        device_id: 'Field Staff',
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
        fields: '["name", "supplier_name"]'
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
        fields: '["uom_name"]'
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

// Function to get warehouses
export const getWarehouses = async () => {
  try {
    const response = await api.get('/frappe.client.get_list', {
      params: {
        doctype: 'Warehouse',
        filters: JSON.stringify([
          ["company", "=", "Durar Masagh Trading Company"],
          ["is_group", "=", 0]
        ]),
        fields: '["warehouse_name"]'
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