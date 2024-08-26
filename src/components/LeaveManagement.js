import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ScrollView } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Modal from 'react-native-modal';
import { Picker } from '@react-native-picker/picker';
import { EmployeeContext } from '../context/EmployeeContext';
import { requestLeave, getLeaveRequests } from '../../api';
import { useNavigation } from '@react-navigation/native'; // Import navigation

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
  const navigation = useNavigation(); // Use navigation

  useEffect(() => {
    if (employeeDetails) {
      fetchLeaveRequests();
    }
  }, [employeeDetails]);

  const fetchLeaveRequests = async () => {
    try {
      const requests = await getLeaveRequests(employeeDetails.name);
      setLeaveRequests(requests.sort((a, b) => new Date(b.from_date) - new Date(a.from_date)));
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };

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
      console.error('Error requesting leave:', errorMessage);
      Alert.alert('Error', `Failed to submit leave request. ${errorMessage}`);
    }
  };

  const handleDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
      });
      setDocument(result);
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User cancelled the document picker');
      } else {
        throw err;
      }
    }
  };

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Request Leave</Text>
        <View style={styles.inputBox}>
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
            <TouchableOpacity style={styles.datePicker} onPress={() => setShowFromDatePicker(true)}>
              <Text style={styles.dateText}>{`From Date: ${fromDate.toDateString()}`}</Text>
            </TouchableOpacity>
            {showFromDatePicker && (
              <DateTimePicker
                value={fromDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowFromDatePicker(false);
                  if (selectedDate) {
                    setFromDate(selectedDate);
                  }
                }}
              />
            )}
            <TouchableOpacity style={styles.datePicker} onPress={() => setShowToDatePicker(true)}>
              <Text style={styles.dateText}>{`To Date: ${toDate.toDateString()}`}</Text>
            </TouchableOpacity>
            {showToDatePicker && (
              <DateTimePicker
                value={toDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowToDatePicker(false);
                  if (selectedDate) {
                    setToDate(selectedDate);
                  }
                }}
              />
            )}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Reason"
            placeholderTextColor="#FFFFFF"
            value={reason}
            onChangeText={setReason}
          />
          <TouchableOpacity style={styles.button} onPress={handleDocumentPicker}>
            <Text style={styles.buttonText}>{document ? document.name : 'Attach Document'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleRequestLeave}>
          <Text style={styles.buttonText}>Request Leave</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={toggleModal}>
          <Text style={styles.buttonText}>View Leave Requests</Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal isVisible={isModalVisible} onBackdropPress={toggleModal}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Leave Requests</Text>
          <ScrollView style={styles.scrollView}>
            {leaveRequests.map((item, index) => (
              <View key={index} style={styles.requestItem}>
                <Text style={styles.requestText}>{item.leave_type} - {item.total_leave_days} days</Text>
                <Text style={styles.requestStatus}>{item.status}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.button, styles.modalButton]} onPress={toggleModal}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  inputBox: {
    width: '90%',
    padding: 20,
    borderWidth: 2,
    borderColor: '#153156',
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  pickerContainer: {
    width: '100%',
    height: 50,
    backgroundColor: '#153156',
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: '100%',
    color: '#FFFFFF',
  },
  dateRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  datePicker: {
    width: '48%',
    height: 50,
    backgroundColor: '#153156',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#153156',
    borderRadius: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
    fontSize: 16,
    color: '#FFFFFF',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 10,
    width: '90%',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
  },
  scrollView: {
    width: '100%',
    maxHeight: 300,
  },
  requestItem: {
    width: '100%',
    padding: 15,
    borderColor: '#153156',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  requestText: {
    fontSize: 16,
    color: '#000',
  },
  requestStatus: {
    fontSize: 16,
    color: '#153156',
  },
  modalButton: {
    marginTop: 10,
    width: '50%',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#153156',
    paddingVertical: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  navbarButton: {
    alignItems: 'center',
    flex: 1,
  },
  navbarButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default LeaveManagement;