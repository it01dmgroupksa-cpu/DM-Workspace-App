import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
} from 'react-native';
import { EmployeeContext } from '../context/EmployeeContext';
import { useNavigation } from '@react-navigation/native';

const EmployeeProfile = () => {
  const { employeeDetails, setEmployeeDetails } = useContext(EmployeeContext);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const navigation = useNavigation();

  // Logout handler
  const handleLogout = () => {
    setEmployeeDetails(null); // Clear employee details from context
    navigation.navigate('Login'); // Navigate to the login screen
  };

  const showLogoutModal = () => {
    setIsLogoutModalVisible(true);
  };

  const hideLogoutModal = () => {
    setIsLogoutModalVisible(false);
  };

  const renderRow = (label, value) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || 'N/A'}</Text>
    </View>
  );

  if (!employeeDetails) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <Image
          source={{ uri: `https://dmgroup.frappe.cloud${employeeDetails.image}` }}
          style={styles.profileImage}
        />
        <Text style={styles.profileName}>{employeeDetails.employee_name}</Text>
        <Text style={styles.profileDesignation}>{employeeDetails.designation}</Text>
      </View>

      {/* Personal Details Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Details</Text>
        {renderRow('Name', employeeDetails.employee_name)}
        {renderRow('Designation', employeeDetails.designation)}
        {renderRow('Department', employeeDetails.department)}
        {renderRow('Date of Birth', employeeDetails.date_of_birth)}
        {renderRow('Nationality', employeeDetails.custom_nationality)}
        {renderRow('Blood Group', employeeDetails.blood_group)}
        {renderRow('Marital Status', employeeDetails.marital_status)}
        {renderRow('Family Background', employeeDetails.family_background)}
        {renderRow('Personal Mobile', employeeDetails.custom_personal_mobile)}
        {renderRow('Emergency Contact', employeeDetails.emergency_phone_number)}
      </View>

      {/* Work Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Work Information</Text>
        {renderRow('Employee Number', employeeDetails.employee_number)}
        {renderRow('Company Email', employeeDetails.company_email)}
        {renderRow('Branch', employeeDetails.branch)}
        {renderRow('Job Location', employeeDetails.custom_job_location)}
        {renderRow('Joining Date', employeeDetails.date_of_joining)}
        {renderRow('Last Rejoin Date', employeeDetails.custom_last_rejoin_date)}
        {renderRow('Retirement Date', employeeDetails.date_of_retirement)}
        {renderRow('Sponsor', employeeDetails.custom_sponsor)}
        {renderRow('Manager', employeeDetails.reports_to)}
        {renderRow('Contract Expiry Date', employeeDetails.agreement_expiry_date)}
      </View>

      {/* Travel Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Travel Information</Text>
        {renderRow('Destination Airport', employeeDetails.custom_destination_airport)}
        {renderRow('Ticket Fair Allotted', employeeDetails.custom_ticket_fair_alloted)}
        {renderRow('Work Location', employeeDetails.custom_job_location)}
      </View>

      {/* Visa and Iqama Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visa & Iqama Information</Text>
        {renderRow('Iqama Number', employeeDetails.iqama__visa_number)}
        {renderRow('Iqama Expiry', employeeDetails.expiry_date)}
        {renderRow('Iqama Profession', employeeDetails.iqama_profession_)}
        {renderRow('Passport Number', employeeDetails.passport_no)}
        {renderRow('Passport Issue Date', employeeDetails.passport_issue_date)}
        {renderRow('Passport Expiry Date', employeeDetails.passport_expiry_date)}
      </View>

      {/* Accommodation Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accommodation</Text>
        {renderRow('Permanent Address', employeeDetails.permanent_address)}
        {renderRow('Current Address', employeeDetails.current_address)}
        {renderRow('Accommodation Type', employeeDetails.current_accommodation_type)}
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={showLogoutModal}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={isLogoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={hideLogoutModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalText}>Are you sure you want to logout?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.confirmButton} onPress={handleLogout}>
                <Text style={styles.buttonText}>Logout</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={hideLogoutModal}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#153156',
  },
  profileDesignation: {
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  value: {
    fontSize: 16,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  logoutButton: {
    backgroundColor: '#D32F2F', // Subtle dark red color
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmButton: {
    backgroundColor: '#D32F2F',
    padding: 10,
    borderRadius: 8,
    width: '45%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
    padding: 10,
    borderRadius: 8,
    width: '45%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EmployeeProfile;
