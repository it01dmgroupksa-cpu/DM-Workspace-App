import React, { useState, useContext, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ScrollView, SafeAreaView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Modal from 'react-native-modal';
import { Picker } from '@react-native-picker/picker';
import { EmployeeContext } from '../context/EmployeeContext';
import { requestLeave, getLeaveRequests } from '../../api';
import {Ionicons} from '@expo/vector-icons';

const leaveTypes = [
  { label: 'Leave Without Pay', value: 'Leave Without Pay' },
  { label: 'Privilege Leave', value: 'Privilege Leave' },
  { label: 'Compensatory Off', value: 'Compensatory Off' },
  { label: 'Casual Leave', value: 'Casual Leave' },
  { label: 'Bereavement leave-INDIRECT', value: 'Bereavement leave-INDIRECT' },
  { label: 'Umra-INDIRECT', value: 'Umra-INDIRECT' },
  { label: 'Annual Leave-INDIRECT', value: 'Annual Leave-INDIRECT' },
  { label: 'Annual Leave-DIRECT', value: 'Annual Leave-DIRECT' },
  { label: 'unpaid leave', value: 'unpaid leave' },
  { label: 'Sick Leave', value: 'Sick Leave' },
  { label: 'Child DIRECT', value: 'Child DIRECT' },
  { label: 'Hajj-INDIRECT', value: 'Hajj-INDIRECT' },
  { label: 'Compassionate-INDIRECT', value: 'Compassionate-INDIRECT' },
  { label: 'Examination-INDirect', value: 'Examination-INDirect' },
  { label: 'Examination-Direct', value: 'Examination-Direct' },
  { label: 'Compassionate-DIRECT', value: 'Compassionate-DIRECT' },
  { label: 'Maternity Leave After Child Birth-ND', value: 'Maternity Leave After Child Birth-ND' },
  { label: 'Marriage-INDirect', value: 'Marriage-INDirect' },
  { label: 'Marriage-Direct', value: 'Marriage-Direct' },
  { label: 'Paternity-INDirect', value: 'Paternity-INDirect' },
  { label: 'Paternity-Direct', value: 'Paternity-Direct' },
  { label: 'Maternity Leave Before Child Birth-ND', value: 'Maternity Leave Before Child Birth-ND' },
  { label: 'Maternity Leave After Child Birth-Direct', value: 'Maternity Leave After Child Birth-Direct' },
  { label: 'Maternity Leave Before Child Birth-Direct', value: 'Maternity Leave Before Child Birth-Direct' },
  { label: 'Iddah-Muslim', value: 'Iddah-Muslim' },
  { label: 'Iddah-Non.Muslim', value: 'Iddah-Non.Muslim' },
  { label: 'Hajj-DIRECT', value: 'Hajj-DIRECT' },
  { label: 'Casual Leave (Unpaid)', value: 'Casual Leave (Unpaid)' },
];

const LeaveManagement = () => {
  const { employeeDetails } = useContext(EmployeeContext);
  const [leaveType, setLeaveType] = useState('');
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [document, setDocument] = useState(null);
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const fetchLeaveRequests = useCallback(async () => {
    if (!employeeDetails?.name) {
      return;
    }

    try {
      const requests = await getLeaveRequests(employeeDetails.name);
      setLeaveRequests(requests.sort((a, b) => new Date(b.from_date) - new Date(a.from_date)));
    } catch (error) {
      console.error("Error fetching leave requests:");
      Alert.alert('Error', 'Failed to fetch leave requests.');
    }
  }, [employeeDetails?.name]);

  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  const handleRequestLeave = async () => {
    if (!leaveType || !fromDate || !toDate || !reason) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const newLeaveRequest = {
        employee: employeeDetails.name,
        leave_type: leaveType,
        from_date: fromDate.toISOString().split('T')[0],
        to_date: toDate.toISOString().split('T')[0],
        reason,
        attach: document ? document.uri : '',
      };
      await requestLeave(newLeaveRequest);
      Alert.alert('Success', 'Leave request submitted');
      setLeaveType('');
      setFromDate(new Date());
      setToDate(new Date());
      setReason('');
      setDocument(null);
      fetchLeaveRequests();
    } catch (error) {
      const errorMessage = error.response?.data?._server_messages
        ? JSON.parse(error.response.data._server_messages).map(msg => JSON.parse(msg).message).join('\n')
        : error.message;
      console.error("Error requesting leave:");
      Alert.alert('Error', `Failed to submit leave request. ${errorMessage}`);
    }
  };

  const handleDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        setDocument({
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        });
      }
    } catch (error) {
      console.error("Failed to select leave attachment:");
      Alert.alert('Error', 'Failed to select the attachment.');
    }
  };

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  const renderDatePicker = (date, setDate, showPicker, setShowPicker, label) => (
    <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowPicker(true)}>
      <Text style={styles.datePickerLabel}>{label}</Text>
      <Text style={styles.datePickerText}>{date.toDateString()}</Text>
      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowPicker(false);
            if (selectedDate) {
              setDate(selectedDate);
            }
          }}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Request Leave</Text>
        <View style={styles.card}>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={leaveType}
              onValueChange={(itemValue) => setLeaveType(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Select Leave Type" value="" />
              {leaveTypes.map((type) => (
                <Picker.Item key={type.value} label={type.label} value={type.value} />
              ))}
            </Picker>
          </View>
          <View style={styles.dateRow}>
            {renderDatePicker(fromDate, setFromDate, showFromDatePicker, setShowFromDatePicker, 'From')}
            {renderDatePicker(toDate, setToDate, showToDatePicker, setShowToDatePicker, 'To')}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Reason for leave"
            placeholderTextColor="#999"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <TouchableOpacity style={styles.attachButton} onPress={handleDocumentPicker}>
            <Ionicons name="attach" size={24} color="#153156" />
            <Text style={styles.attachButtonText}>
              {document ? document.name : 'Attach Document'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.submitButton} onPress={handleRequestLeave}>
          <Text style={styles.submitButtonText}>Submit Request</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.viewRequestsButton} onPress={toggleModal}>
          <Text style={styles.viewRequestsButtonText}>View Leave Requests</Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal isVisible={isModalVisible} onBackdropPress={toggleModal}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Leave Requests</Text>
          <FlatList
            data={leaveRequests}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <View style={styles.requestItem}>
                <View>
                  <Text style={styles.requestType}>{item.leave_type}</Text>
                  <Text style={styles.requestDays}>{item.total_leave_days} days</Text>
                </View>
                <Text style={[styles.requestStatus, { color: item.status === 'Approved' ? '#4CAF50' : '#FFC107' }]}>
                  {item.status}
                </Text>
              </View>
            )}
            style={styles.requestList}
          />
          <TouchableOpacity style={styles.closeModalButton} onPress={toggleModal}>
            <Text style={styles.closeModalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContainer: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  datePickerButton: {
    flex: 1,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 10,
  },
  datePickerLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 5,
  },
  datePickerText: {
    fontSize: 16,
    color: '#153156',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
    color: '#153156',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#153156',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  attachButtonText: {
    marginLeft: 10,
    color: '#153156',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewRequestsButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#153156',
  },
  viewRequestsButtonText: {
    color: '#153156',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 15,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
    textAlign: 'center',
  },
  requestList: {
    maxHeight: 300,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  requestType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#153156',
  },
  requestDays: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  requestStatus: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeModalButton: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  closeModalButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default LeaveManagement;