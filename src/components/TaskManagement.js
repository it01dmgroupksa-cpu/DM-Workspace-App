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
    status: 'Open',
    employee_division: '',
    branch: '',
    date: new Date(),
    assigned_by: employeeDetails
      ? employeeDetails.employee_name
      : 'Current User',
    taskDetails: [
      {
        description: '',
        start_datetime: new Date(),
        end_datetime: new Date(),
        status: false,
        hours_spent: '',
        result: '',
      },
    ],
    customer: '',
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [activeDatePickerIndex, setActiveDatePickerIndex] = useState(null);

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

  const handleTaskDetailChange = (index, field, value) => {
    const updatedTaskDetails = [...newTask.taskDetails];
    updatedTaskDetails[index] = {...updatedTaskDetails[index], [field]: value};
    setNewTask({...newTask, taskDetails: updatedTaskDetails});
  };

  const addTaskDetail = () => {
    setNewTask({
      ...newTask,
      taskDetails: [
        ...newTask.taskDetails,
        {
          description: '',
          start_datetime: new Date(),
          end_datetime: new Date(),
          status: false,
          hours_spent: '',
          result: '',
        },
      ],
    });
  };

  const removeTaskDetail = index => {
    const updatedTaskDetails = newTask.taskDetails.filter((_, i) => i !== index);
    setNewTask({...newTask, taskDetails: updatedTaskDetails});
  };

  const handleAddTask = () => {
    if (newTask.taskDetails.some(detail => !detail.description || !detail.start_datetime || !detail.end_datetime)) {
      Alert.alert('Error', 'Please fill in all mandatory fields for each task detail');
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
      taskDetails: [
        {
          description: '',
          start_datetime: new Date(),
          end_datetime: new Date(),
          status: false,
          hours_spent: '',
          result: '',
        },
      ],
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
  
    for (let task of tasks) {
      if (!task.employee) {
        Alert.alert('Error', 'Each task must have an assigned employee.');
        return;
      }
    }
  
    console.log("Submitting the following tasks:", JSON.stringify(tasks, null, 2));
  
    try {
      for (let task of tasks) {
        const response = await createTask(task);
        console.log('Task created:', response);
      }
      Alert.alert('Success', 'All tasks submitted successfully');
      setTasks([]);
    } catch (error) {
      console.error('Error submitting tasks:', error);
      let errorMessage = 'Failed to submit tasks. Please try again.';
      if (error.response && error.response.data && error.response.data._server_messages) {
        try {
          const serverMessages = JSON.parse(error.response.data._server_messages);
          errorMessage = serverMessages[0].message || errorMessage;
        } catch (parseError) {
          console.error('Error parsing server messages:', parseError);
        }
      }
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Create Tasks</Text>

        <Text style={styles.label}>Employee</Text>
        <Dropdown
          style={[styles.input, styles.dropdown]}
          placeholderStyle={styles.placeholderStyle}
          selectedTextStyle={styles.selectedTextStyle}
          inputSearchStyle={styles.inputSearchStyle}
          iconStyle={styles.iconStyle}
          data={employees.map(employee => ({
            label: employee.name,
            value: employee.name,
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
            onValueChange={value => handleInputChange('status', value)}
            style={styles.picker}>
            <Picker.Item label="Open" value="Open" />
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

        <Modal
          isVisible={isModalVisible}
          onBackdropPress={() => setIsModalVisible(false)}>
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={styles.modalScrollContainer}>
              <Text style={styles.modalTitle}>Task Details</Text>

              {newTask.taskDetails.map((detail, index) => (
                <View key={index} style={styles.taskDetailContainer}>
                  <Text style={styles.taskDetailTitle}>Task {index + 1}</Text>

                  <Text style={styles.label}>Task Description</Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Enter task description"
                    placeholderTextColor="#B0B0B0"
                    value={detail.description}
                    onChangeText={value => handleTaskDetailChange(index, 'description', value)}
                    multiline
                  />

                  <Text style={styles.label}>Start Date & Time</Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => {
                      setActiveDatePickerIndex(index);
                      setShowStartDatePicker(true);
                    }}>
                    <Text style={styles.dateText}>
                      {detail.start_datetime.toLocaleString()}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>End Date & Time</Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => {
                      setActiveDatePickerIndex(index);
                      setShowEndDatePicker(true);
                    }}>
                    <Text style={styles.dateText}>
                      {detail.end_datetime.toLocaleString()}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Hours Spent</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter hours spent"
                    placeholderTextColor="#B0B0B0"
                    value={detail.hours_spent}
                    onChangeText={value => handleTaskDetailChange(index, 'hours_spent', value)}
                  />

                  <Text style={styles.label}>Result</Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Enter result"
                    placeholderTextColor="#B0B0B0"
                    value={detail.result}
                    onChangeText={value => handleTaskDetailChange(index, 'result', value)}
                    multiline
                  />

                  {index > 0 && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeTaskDetail(index)}>
                      <Text style={styles.buttonText}>Remove Task</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={styles.addButton}
                onPress={addTaskDetail}>
                <Text style={styles.buttonText}>Add Another Task</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddTask}>
                <Text style={styles.buttonText}>
                  {isEditing ? 'Update Task' : 'Add Task'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsModalVisible(false)}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        <DateTimePickerModal
          isVisible={showStartDatePicker}
          mode="datetime"
          onConfirm={date => {
            setShowStartDatePicker(false);
            handleTaskDetailChange(activeDatePickerIndex, 'start_datetime', date);
          }}
          onCancel={() => setShowStartDatePicker(false)}
        />

        <DateTimePickerModal
          isVisible={showEndDatePicker}
          mode="datetime"
          onConfirm={date => {
            setShowEndDatePicker(false);
            handleTaskDetailChange(activeDatePickerIndex, 'end_datetime', date);
          }}
          onCancel={() => setShowEndDatePicker(false)}
        />

        <Text style={styles.label}>Added Tasks</Text>
        {tasks.length === 0 ? (
          <Text>No tasks added</Text>
        ) : (
          tasks.map((task, index) => (
            <TouchableOpacity key={index} onPress={() => handleEditTask(index)}>
              <View style={styles.taskItem}>
                <Text>{`Task ${index + 1}: ${task.taskDetails[0].description}`}</Text>
                <Text>{`Employee: ${task.employee}`}</Text>
                <Text>{`Category: ${task.task_category}`}</Text>
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#153156',
    marginBottom: 8,
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
  dateText: {
    fontSize: 16,
    color: '#153156',
  },
  pickerContainer: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E7FF',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  picker: {
    width: '100%',
    height: '100%',
  },
  textArea: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E7FF',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#153156',
    marginBottom: 20,
    textAlignVertical: 'top',
    height: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addButton: {
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
  saveButton: {
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
  submitButton: {
    backgroundColor: '#153156',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxHeight: '90%',
  },
  modalScrollContainer: {
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalCloseButton: {
    backgroundColor: '#153156',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
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
  taskItem: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dropdown: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E7FF',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  removeButton: {
    backgroundColor: '#FF4757',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  taskDetailContainer: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskDetailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 12,
  },
});

export default TaskManagement;
