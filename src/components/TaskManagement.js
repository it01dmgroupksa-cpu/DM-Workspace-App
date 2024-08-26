import React, {useState, useContext, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import Modal from 'react-native-modal';
import {Picker} from '@react-native-picker/picker';
import {EmployeeContext} from '../context/EmployeeContext';
import {Dropdown} from 'react-native-element-dropdown';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import {
  getAllEmployees,
  getTaskCategories,
  getBranches,
  createTask,
  getTaskStatus,
  getTaskEmployeeDivision,
} from '../../api';

const TaskManagement = () => {
  const {employeeDetails} = useContext(EmployeeContext);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState([]);
  const [EmpDivison, setEmpDivison] = useState([]);
  const [branches, setBranches] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    employee: '',
    task_category: '',
    status: '',
    employee_division: '',
    branch: '',
    date: new Date(),
    assigned_by: employeeDetails
      ? employeeDetails.employee_name
      : 'Current User',
    start_datetime: new Date(),
    end_datetime: new Date(),
    description: '',
    hours_spent: '',
    result: '',
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchCategories();
    fetchBranches();
    fetchEmpDivison();
    fetchStatus();
  }, []);

  const fetchEmployees = async () => {
    try {
      const data = await getAllEmployees();
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await getTaskCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchEmpDivison = async () => {
    try {
      const data = await getTaskEmployeeDivision();
      setEmpDivison(data);
    } catch (error) {
      console.error('Error fetching Divisons:', error);
    }
  };

  const fetchStatus = async () => {
    try {
      const data = await getTaskStatus();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching Status:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(data);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setNewTask({...newTask, [field]: value});
  };

  const handleStatusChange = value => {
    handleInputChange('status', value);

    if (value === 'Completed') {
      const currentDate = new Date();
      handleInputChange('end_datetime', currentDate);

      const timeSpent = calculateTimeDifference(
        newTask.start_datetime,
        currentDate,
      );
      handleInputChange('hours_spent', timeSpent);
    }
  };

  const calculateTimeDifference = (start, end) => {
    const diffInMilliseconds = end - start;
    const days = Math.floor(diffInMilliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffInMilliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor(
      (diffInMilliseconds % (1000 * 60 * 60)) / (1000 * 60),
    );

    return `${days}D ${hours}H ${minutes}M`;
  };

  const handleAddTask = () => {
    if (
      !newTask.description ||
      !newTask.start_datetime ||
      !newTask.end_datetime
    ) {
      Alert.alert('Error', 'Please fill in all mandatory fields');
      return;
    }

    if (isEditing) {
      const updatedTasks = [...tasks];
      updatedTasks[editIndex] = newTask;
      setTasks(updatedTasks);
      setIsEditing(false);
      setEditIndex(null);
    } else {
      setTasks([...tasks, newTask]);
    }

    setIsModalVisible(false);
    setNewTask({
      ...newTask,
      description: '',
      start_datetime: new Date(),
      end_datetime: new Date(),
      hours_spent: '',
      result: '',
    });
  };

  const handleEditTask = index => {
    setNewTask(tasks[index]);
    setIsEditing(true);
    setEditIndex(index);
    setIsModalVisible(true);
  };

  const handleSubmitAllTasks = async () => {
    if (tasks.length === 0) {
      Alert.alert('Error', 'No tasks added');
      return;
    }

    try {
      await Promise.all(tasks.map(task => createTask(task)));
      Alert.alert('Success', 'All tasks submitted successfully');
      setTasks([]);
    } catch (error) {
      console.error('Error submitting tasks:', error.message);
      Alert.alert('Error', 'Failed to submit tasks');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Task Management</Text>

        <Text style={styles.label}>Employee</Text>
        <Dropdown
          style={[styles.input, styles.dropdown]}
          placeholderStyle={styles.placeholderStyle}
          selectedTextStyle={styles.selectedTextStyle}
          inputSearchStyle={styles.inputSearchStyle}
          iconStyle={styles.iconStyle}
          data={employees.map(employee => ({
            label: employee.employee_name,
            value: employee.employee_name,
          }))}
          search
          maxHeight={300}
          labelField="label"
          valueField="value"
          placeholder="Select Employee"
          searchPlaceholder="Search..."
          value={newTask.employee}
          onChange={item => handleInputChange('employee', item.value)}
        />

        <Text style={styles.label}>Task Category</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={newTask.task_category}
            onValueChange={value => handleInputChange('task_category', value)}
            style={styles.picker}>
            <Picker.Item label="Select Category" value="" />
            {categories &&
              categories.map(category => (
                <Picker.Item
                  key={category.task_category}
                  label={category.task_category}
                  value={category.task_category}
                />
              ))}
          </Picker>
        </View>

        <Text style={styles.label}>Status</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={newTask.status}
            onValueChange={value => handleStatusChange(value)}
            style={styles.picker}>
            <Picker.Item label="Select Status" value="" />
            <Picker.Item label="Incomplete" value="Incomplete" />
            <Picker.Item label="Completed" value="Completed" />
          </Picker>
        </View>

        <Text style={styles.label}>Employee Division</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={newTask.employee_division}
            onValueChange={value =>
              handleInputChange('employee_division', value)
            }
            style={styles.picker}>
            <Picker.Item label="Select Employee Division" value="" />
            {EmpDivison.map(division => (
              <Picker.Item
                key={division.employee_division}
                label={division.employee_division}
                value={division.employee_division}
              />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Branch</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={newTask.branch}
            onValueChange={value => handleInputChange('branch', value)}
            style={styles.picker}>
            <Picker.Item label="Select Branch" value="" />
            {branches &&
              branches.map(branch => (
                <Picker.Item
                  key={branch.branch}
                  label={branch.branch}
                  value={branch.branch}
                />
              ))}
          </Picker>
        </View>

        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={newTask.date.toDateString()}
          editable={false}
          placeholderTextColor="#B0B0B0"
        />

        <Text style={styles.label}>Assigned By</Text>
        <TextInput
          style={styles.input}
          value={newTask.assigned_by}
          editable={false}
          placeholderTextColor="#B0B0B0"
        />

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsModalVisible(true)}>
          <Text style={styles.buttonText}>Add Task Details</Text>
        </TouchableOpacity>

        <Modal isVisible={isModalVisible} onBackdropPress={() => setIsModalVisible(false)}>
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={styles.modalScrollContainer}>
              <Text style={styles.modalTitle}>Task Details</Text>

              <Text style={styles.label}>Task Description</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Enter task description"
                placeholderTextColor="#B0B0B0"
                value={newTask.description}
                onChangeText={(value) => handleInputChange('description', value)}
                multiline
              />

              <Text style={styles.label}>Start Date & Time</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {newTask.start_datetime
                    ? newTask.start_datetime.toLocaleString()
                    : 'Select Start Date & Time'}
                </Text>
              </TouchableOpacity>
              <DateTimePickerModal
                isVisible={showStartDatePicker}
                mode="datetime"
                onConfirm={(date) => {
                  setShowStartDatePicker(false);
                  handleInputChange('start_datetime', date);
                }}
                onCancel={() => setShowStartDatePicker(false)}
              />

              <Text style={styles.label}>Status</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={newTask.status}
                  onValueChange={(value) => handleStatusChange(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Open" value="Open" />
                  <Picker.Item label="Completed" value="Completed" />
                </Picker>
              </View>

              <Text style={styles.label}>End Date & Time</Text>
              <TextInput
                style={styles.input}
                value={newTask.end_datetime ? newTask.end_datetime.toLocaleString() : 'Pending Completion'}
                editable={false}
                placeholderTextColor="#B0B0B0"
              />

              <Text style={styles.label}>Hours Spent</Text>
              <TextInput
                style={styles.input}
                value={newTask.hours_spent}
                editable={false}
                placeholder="Auto-calculated"
                placeholderTextColor="#B0B0B0"
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleAddTask}>
                <Text style={styles.buttonText}>{isEditing ? 'Update Task' : 'Add Task'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        <Text style={styles.label}>Added Tasks</Text>
        {tasks.length === 0 ? (
          <Text>No tasks added</Text>
        ) : (
          tasks.map((task, index) => (
            <TouchableOpacity key={index} onPress={() => handleEditTask(index)}>
              <View style={styles.taskItem}>
                <Text>{`Task ${index + 1}: ${task.description}`}</Text>
                <Text>{`Start Date: ${task.start_datetime.toLocaleString()}`}</Text>
                <Text>{`End Date: ${task.end_datetime ? task.end_datetime.toLocaleString() : 'Not Completed'}`}</Text>
                <Text>{`Hours Spent: ${task.hours_spent}`}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={[styles.submitButton, {marginBottom: 50}]}
          onPress={handleSubmitAllTasks}>
          <Text style={styles.buttonText}>Submit All Tasks</Text>
        </TouchableOpacity>
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
  label: {
    fontSize: 16,
    color: '#153156',
    marginBottom: 10,
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
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#153156',
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
  textArea: {
    width: '100%',
    borderColor: '#153156',
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
    fontSize: 16,
    color: '#153156',
    marginBottom: 20,
    textAlignVertical: 'top',
    height: 100,
  },
  addButton: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '100%',
  },
  modalScrollContainer: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalCloseButton: {
    backgroundColor: '#153156',
    paddingVertical: 10,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  taskItem: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    marginBottom: 10,
    borderRadius: 10,
    width: '100%',
  },
  dropdown: {
    height: 50,
    borderColor: '#153156',
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  placeholderStyle: {
    fontSize: 16,
    color: '#B0B0B0',
  },
  selectedTextStyle: {
    fontSize: 16,
    color: '#153156',
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
});

export default TaskManagement;
