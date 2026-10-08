import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmployeeContext } from '../context/EmployeeContext';
import { getAssignedTasks, getTaskDetails, updateTaskDetail } from '../../api';
import TaskDescription from './TaskDescription';

const AssignedTasksView = () => {
  const { employeeDetails } = useContext(EmployeeContext);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scrollEnabled, setScrollEnabled] = useState(true); // To handle scroll interaction
  const navigation = useNavigation();

  const fetchTasks = useCallback(async () => {
    if (!employeeDetails?.name) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const assignedTasks = await getAssignedTasks(employeeDetails.name);
      const tasksWithDetails = await Promise.all(
        assignedTasks.map(async task => {
          const details = await getTaskDetails(task.name);
          return { ...task, ...details };
        }),
      );
      const sortedTasks = tasksWithDetails.sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      );
      setTasks(sortedTasks);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch tasks. Please try again later.');
      console.error("Error fetching tasks:");
    } finally {
      setLoading(false);
    }
  }, [employeeDetails?.name]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const navigateToCreateTasks = () => {
    navigation.navigate('TaskManagement');
  };

  const calculateTimeSpent = (startDate, endDate) => {
    const diffInMs = endDate - startDate;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    return diffInHours.toFixed(2);
  };

  const handleTaskCompletion = async (taskId, detailId, completed) => {
    try {
      const task = tasks.find(t => t.name === taskId);
      const taskDetail = task.task_details.find(d => d.name === detailId);
      const startDate = new Date(taskDetail.start_datetime);
      const endDate = completed
        ? new Date()
        : new Date(taskDetail.end_datetime);
      const timeSpent = completed
        ? calculateTimeSpent(startDate, endDate)
        : null;

      await updateTaskDetail(taskId, detailId, {
        status: completed ? 'Completed' : 'Open',
        hours_spent: timeSpent,
        start_datetime: startDate,
        end_datetime: endDate,
        employee: employeeDetails.name, // Include the employee name
      });
      await fetchTasks();
    } catch (error) {
      Alert.alert('Error', 'Failed to update task. Please try again.');
      console.error("Error updating task:");
    }
  };

  const handleResultChange = async (taskId, detailId, result) => {
    try {
      await updateTaskDetail(taskId, detailId, {
        result,
        employee: employeeDetails.name, // Include the employee name
      });
      await fetchTasks();
    } catch (error) {
      Alert.alert('Error', 'Failed to update task result. Please try again.');
      console.error("Error updating task result:");
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        scrollEnabled={scrollEnabled} // Control scroll with state
      >
        <Text style={styles.title}>Tasks Management</Text>
        <TouchableOpacity
          style={styles.createTaskButton}
          onPress={navigateToCreateTasks}>
          <Text style={styles.buttonText}>Create Tasks</Text>
        </TouchableOpacity>
        {tasks.map(task => (
          <View key={task.name} style={styles.taskItem}>
            <Text style={styles.taskTitle}>Task #{task.name}</Text>
            <Text style={styles.label}>Status: {task.status}</Text>
            <Text style={styles.label}>Assigned By: {task.assigned_by}</Text>
            <Text style={styles.label}>Category: {task.task_category}</Text>
            <Text style={styles.label}>
              Date: {new Date(task.date).toLocaleDateString()}
            </Text>

            {task.task_details &&
              task.task_details.map((detail, index) => (
                <View key={index} style={styles.taskDetailContainer}>
                  <Text style={styles.taskDetailTitle}>
                    Task Detail {index + 1}
                  </Text>
                  <Text style={styles.label}>Description:</Text>
                  
                  <TaskDescription
                    description={detail.task_description}
                    onInteractionStart={() => setScrollEnabled(false)} // Disable ScrollView scroll when interacting
                    onInteractionEnd={() => setScrollEnabled(true)} // Enable ScrollView scroll after interaction
                  />
                  
                  <Text style={styles.label}>
                    Start Date & Time:{' '}
                    {new Date(detail.start_datetime).toLocaleString()}
                  </Text>
                  <Text style={styles.label}>
                    End Date & Time:{' '}
                    {new Date(detail.end_datetime).toLocaleString()}
                  </Text>

                  {/* <View style={styles.checkboxContainer}>
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        detail.status === 'Completed' && styles.checkedBox
                      ]}
                      onPress={() =>
                        handleTaskCompletion(
                          task.name,
                          detail.name,
                          detail.status !== 'Completed',
                        )
                      }>
                      {detail.status === 'Completed' && (
                        <Text style={styles.checkboxLabel}>✔</Text>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.label}>Complete</Text>
                  </View> */}

                  {detail.status === 'Completed' && (
                    <Text style={styles.label}>
                      Time Spent: {detail.hours_spent} hours
                    </Text>
                  )}

                  <Text style={styles.label}>Result</Text>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    value={detail.result || ''}
                    placeholder="Enter result"
                    placeholderTextColor="#B0B0B0"
                  />

                  {/* <TouchableOpacity
                    style={styles.updateButton}
                    onPress={() =>
                      handleResultChange(task.name, detail.name, detail.result)
                    }>
                    <Text style={styles.buttonText}>Update</Text>
                  </TouchableOpacity> */}
                </View>
              ))}
          </View>
        ))}

        <TouchableOpacity style={styles.refreshButton} onPress={fetchTasks}>
          <Text style={styles.buttonText}>Refresh Tasks</Text>
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
  taskItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#153156',
    marginBottom: 8,
  },
  taskDetailContainer: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  taskDetailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#153156',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#4CAF50', // Add background color for checked state
  },
  checkboxLabel: {
    color: '#FFFFFF', // Checkmark color
    fontWeight: 'bold',
  },
  textArea: {
    width: '100%',
    height: 100,
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E7FF',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 20,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#153156',
  },
  refreshButton: {
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
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createTaskButton: {
    backgroundColor: '#4CAF50',
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
  updateButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginTop: 10,
  },
});

export default AssignedTasksView;
