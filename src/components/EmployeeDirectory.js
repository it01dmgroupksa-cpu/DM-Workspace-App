import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Linking } from 'react-native';
import { getAllEmployeesDir } from '../../api';
import { EmployeeContext } from '../context/EmployeeContext'; // Importing EmployeeContext

const EmployeeDirectory = () => {
  const [employees, setEmployees] = useState([]); // Store all employee details
  const [filteredEmployees, setFilteredEmployees] = useState([]); // For search results
  const [selectedEmployee, setSelectedEmployee] = useState(null); // For modal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('employee_name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { employeeDetails } = useContext(EmployeeContext); // Access the logged-in employee's details
  const loggedInEmployeeId = employeeDetails.name; // This is the employee_id of the logged-in user

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = employees.filter(emp => {
        if (!isNaN(searchQuery)) {
          // If the search query is a number, search by employee_id
          return emp.employee_id.includes(searchQuery);
        } else {
          // Otherwise, search by employee_name
          return emp.employee_name.toLowerCase().includes(searchQuery.toLowerCase());
        }
      });
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
    }
  }, [searchQuery, employees]);

  const fetchEmployees = async () => {
    try {
      const data = await getAllEmployeesDir();
      const filteredData = data.employee_details
        .filter(emp => emp.employee_id !== loggedInEmployeeId) // Exclude the logged-in employee
        .filter(emp => emp.status !== 'Inactive'); // Exclude inactive employees
      
      setEmployees(filteredData);
      setFilteredEmployees(filteredData); // Also set this for the initial view
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleSearch = () => {
    // Search logic is handled by the useEffect above
  };

  const handleSort = (field) => {
    const order = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(field);
    setSortOrder(order);
    const sorted = [...filteredEmployees].sort((a, b) => {
      if (a[field] < b[field]) return order === 'asc' ? -1 : 1;
      if (a[field] > b[field]) return order === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredEmployees(sorted);
  };

  const handleEmployeeClick = (employeeId) => {
    const employee = employees.find(emp => emp.employee_id === employeeId);
    setSelectedEmployee(employee);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedEmployee(null);
  };

  const handlePhonePress = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleEmailPress = (email) => {
    Linking.openURL(`mailto:${email}`);
  };

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  const displayedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text
              style={styles.tableHeaderText}
              onPress={() => handleSort('employee_id')}>
              Employee ID
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
              key={employee.employee_id}
              style={styles.tableRow}
              onPress={() => handleEmployeeClick(employee.employee_id)}>
              <Text style={styles.tableRowText}>
                {employee.employee_id}
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
            style={[styles.paginationButton, currentPage === 1 && styles.disabledButton]}
            onPress={handlePreviousPage}
            disabled={currentPage === 1}>
            <Text style={styles.paginationButtonText}>Previous</Text>
          </TouchableOpacity>
          <Text style={styles.paginationText}>
            Page {currentPage} of {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.paginationButton, currentPage === totalPages && styles.disabledButton]}
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
                <Text style={styles.modalTitle}>{selectedEmployee.employee_name}</Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Employee ID:</Text> {selectedEmployee.employee_id}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Job Location:</Text> {selectedEmployee.custom_job_location}
                </Text>
                <Text style={styles.modalText} onPress={() => handlePhonePress(selectedEmployee.cell_number)}>
                  <Text style={styles.modalLabel}>Company Phone:</Text> {selectedEmployee.cell_number}
                </Text>
                <Text style={styles.modalText} onPress={() => handleEmailPress(selectedEmployee.company_email)}>
                  <Text style={styles.modalLabel}>Company Email:</Text> {selectedEmployee.company_email}
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
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  scrollContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E7FF',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 16,
    color: '#153156',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchButton: {
    backgroundColor: '#153156',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F0F4FF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
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
    marginTop: 24,
    marginBottom: 40,
  },
  paginationButton: {
    backgroundColor: '#153156',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  paginationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paginationText: {
    fontSize: 16,
    color: '#153156',
    fontWeight: '600',
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
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 12,
    color: '#153156',
  },
  modalLabel: {
    fontWeight: 'bold',
    color: '#153156',
  },
  modalCloseButton: {
    backgroundColor: '#153156',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default EmployeeDirectory;
