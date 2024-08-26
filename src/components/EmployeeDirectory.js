import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  getAllEmployees,
  getEmployeesByDepartment,
  searchEmployees,
  sortEmployees,
  getEmployeeById,
  getDepartments,
} from '../../api';

const EmployeeDirectory = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [sortBy, setSortBy] = useState('employee_name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, [currentPage]);

  const fetchEmployees = async () => {
    try {
      const data = await getAllEmployees();
      const activeEmployees = data.filter(emp => emp.status === 'Active'); // Filter by active status
      setEmployees(activeEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleSearch = async () => {
    try {
      const result = await searchEmployees(searchQuery);
      const activeEmployees = result.filter(emp => emp.status === 'Active'); // Filter by active status
      setEmployees(activeEmployees);
    } catch (error) {
      console.error('Error searching employees:', error);
    }
  };

  const handleDepartmentFilter = async value => {
    setDepartment(value);
    if (value === '') {
      fetchEmployees(); // Fetch all employees without any department filter
    } else {
      const result = await getEmployeesByDepartment(value);
      const activeEmployees = result.filter(emp => emp.status === 'Active'); // Filter by active status
      setEmployees(activeEmployees);
    }
  };

  const handleSort = async field => {
    const order = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(field);
    setSortOrder(order);
    const result = await sortEmployees(field, order);
    const activeEmployees = result.filter(emp => emp.status === 'Active'); // Filter by active status
    setEmployees(activeEmployees);
  };

  const handleEmployeeClick = async employeeId => {
    const employee = await getEmployeeById(employeeId);
    setSelectedEmployee(employee);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedEmployee(null);
  };

  const totalPages = Math.ceil(employees.length / itemsPerPage);

  const displayedEmployees = employees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const truncateText = (text, maxLength) => {
    if (text.length > maxLength) {
      return `${text.substring(0, maxLength)}...`;
    }
    return text;
  };

  const handlePhonePress = phoneNumber => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleEmailPress = email => {
    Linking.openURL(`mailto:${email}`);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Employee Directory</Text>

        <TextInput
          style={styles.input}
          placeholder="Search by name or employee number..."
          placeholderTextColor="#153156"
          value={searchQuery}
          onChangeText={text => setSearchQuery(text)}
        />

        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.buttonText}>Search</Text>
        </TouchableOpacity>

        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={department}
            onValueChange={value => handleDepartmentFilter(value)}
            style={styles.picker}>
            <Picker.Item label="All Departments" value="" />
            {departments.map((dept, index) => (
              <Picker.Item key={index} label={dept.name} value={dept.name} />
            ))}
          </Picker>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text
              style={styles.tableHeaderText}
              onPress={() => handleSort('employee_number')}>
              Employee Number
            </Text>
            <Text
              style={styles.tableHeaderText}
              onPress={() => handleSort('employee_name')}>
              Full Name
            </Text>
            <Text
              style={styles.tableHeaderText}
              onPress={() => handleSort('custom_job_location')}>
              Job Location
            </Text>
          </View>

          {displayedEmployees.map(employee => (
            <TouchableOpacity
              key={employee.name}
              style={styles.tableRow}
              onPress={() => handleEmployeeClick(employee.name)}>
              <Text style={styles.tableRowText}>
                {employee.employee_number}
              </Text>
              <Text style={styles.tableRowText}>
                {truncateText(employee.employee_name, 20)}
              </Text>
              <Text style={styles.tableRowText}>
                {employee.custom_job_location}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[
              styles.paginationButton,
              currentPage === 1 && styles.disabledButton,
            ]}
            onPress={handlePreviousPage}
            disabled={currentPage === 1}>
            <Text style={styles.paginationButtonText}>Previous</Text>
          </TouchableOpacity>
          <Text style={styles.paginationText}>
            Page {currentPage} of {totalPages}
          </Text>
          <TouchableOpacity
            style={[
              styles.paginationButton,
              currentPage === totalPages && styles.disabledButton,
            ]}
            onPress={handleNextPage}
            disabled={currentPage === totalPages}>
            <Text style={styles.paginationButtonText}>Next</Text>
          </TouchableOpacity>
        </View>

        {isModalVisible && selectedEmployee && (
          <Modal
            transparent={true}
            animationType="slide"
            visible={isModalVisible}
            onRequestClose={handleCloseModal}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {selectedEmployee.employee_name}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Employee Number:</Text>{' '}
                  {selectedEmployee.employee_number}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Department:</Text>{' '}
                  {selectedEmployee.department}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Job Location:</Text>{' '}
                  {selectedEmployee.custom_job_location}
                </Text>
                <Text
                  style={[styles.modalText]}
                  onPress={() => handlePhonePress(selectedEmployee.cell_number)}>
                  <Text style={styles.modalLabel}>Company Phone:</Text>{' '}
                  {selectedEmployee.cell_number}
                </Text>
                <Text
                  style={[styles.modalText]}
                  onPress={() => handleEmailPress(selectedEmployee.company_email)}>
                  <Text style={styles.modalLabel}>Company Email:</Text>{' '}
                  {selectedEmployee.company_email}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={handleCloseModal}>
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  scrollContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#153156',
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 20,
    marginBottom: 20,
    fontSize: 16,
    color: '#153156',
  },
  searchButton: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerContainer: {
    width: '100%',
    height: 50,
    borderColor: '#153156',
    borderWidth: 1,
    borderRadius: 30,
    marginBottom: 20,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: '100%',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#153156',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#153156',
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#153156',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tableRowText: {
    flex: 1,
    fontSize: 16,
    color: '#153156',
    textAlign: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  paginationButton: {
    backgroundColor: '#153156',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginHorizontal: 10,
  },
  paginationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paginationText: {
    fontSize: 16,
    color: '#153156',
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
  },
  modalLabel: {
    fontWeight: 'bold',
  },
  modalCloseButton: {
    backgroundColor: '#153156',
    paddingVertical: 10,
    borderRadius: 30,
    alignItems: 'center',
  },
  linkText: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
});

export default EmployeeDirectory;
