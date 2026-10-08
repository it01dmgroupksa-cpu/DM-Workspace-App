import React, { useState, useContext, useEffect, useCallback } from 'react';
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
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import {
  createMaterialsRequest,
  getRequestTypes,
  getUnitOptions,
  getDraftRequests,
  getSubmittedRequests,
  submitDraftRequest,
} from '../../api';

const MaterialsServiceRequestForm = () => {
  const {employeeDetails} = useContext(EmployeeContext);
  const [requestTypes, setRequestTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState({
    date: new Date(),
    employee: employeeDetails ? employeeDetails.name : '',
    department: employeeDetails ? employeeDetails.department : '',
    branch: employeeDetails ? employeeDetails.custom_job_location : '',
    request_type: '',
    description_req: '',
    item_details: [
      {
        item_name: '',
        item_description: '',
        quantity: '',
        unit: '',
        price: '',
        currency: 'SR',
        total: '',
      },
    ],
    total_amount: 0,
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDraftModalVisible, setIsDraftModalVisible] = useState(false);
  const [isSubmittedModalVisible, setIsSubmittedModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [unitOptions, setUnitOptions] = useState([]);
  const [draftRequests, setDraftRequests] = useState([]);
  const [submittedRequests, setSubmittedRequests] = useState([]);

  useEffect(() => {
    fetchUnits();
    fetchRequestTypes();
    fetchDraftRequests();
    fetchSubmittedRequests();
  }, [fetchDraftRequests, fetchSubmittedRequests]);

  const fetchUnits = async () => {
    try {
      const units = await getUnitOptions();
      setUnitOptions(units || []);
    } catch (error) {
      console.error("Error fetching units:");
      Alert.alert('Error', 'Failed to fetch unit options.');
    }
  };

  const fetchRequestTypes = async () => {
    try {
      const types = await getRequestTypes();
      setRequestTypes(types || []);
    } catch (error) {
      console.error("Error fetching request types:");
      Alert.alert('Error', 'Failed to fetch request types.');
    }
  };

  const fetchDraftRequests = useCallback(async () => {
    if (!employeeDetails?.name) {
      setDraftRequests([]);
      return;
    }

    try {
      const drafts = await getDraftRequests(employeeDetails.name);
      setDraftRequests(drafts || []);
    } catch (error) {
      console.error("Error fetching draft requests:");
      Alert.alert('Error', 'Failed to fetch draft requests.');
    }
  }, [employeeDetails]);

  const fetchSubmittedRequests = useCallback(async () => {
    try {
      if (employeeDetails && employeeDetails.name) {
        const submitted = await getSubmittedRequests(employeeDetails.name);
        setSubmittedRequests(submitted);
      } else {
        console.error("Employee details not available");
        setSubmittedRequests([]);
      }
    } catch (error) {
      console.error("Error fetching submitted requests:");
      Alert.alert('Error', 'Failed to fetch submitted requests.');
      setSubmittedRequests([]);
    }
  }, [employeeDetails]);

  const handleInputChange = (field, value) => {
    setNewRequest({...newRequest, [field]: value});
  };

  const handleItemDetailChange = (index, field, value) => {
    const updatedItemDetails = [...newRequest.item_details];
    updatedItemDetails[index] = {...updatedItemDetails[index], [field]: value};

    if (field === 'quantity' || field === 'price') {
      const quantity = parseFloat(updatedItemDetails[index].quantity) || 0;
      const price = parseFloat(updatedItemDetails[index].price) || 0;
      updatedItemDetails[index].total = (quantity * price).toFixed(2);
    }

    const totalAmount = updatedItemDetails.reduce(
      (sum, item) => sum + parseFloat(item.total || 0),
      0,
    );

    setNewRequest({
      ...newRequest,
      item_details: updatedItemDetails,
      total_amount: totalAmount.toFixed(2),
    });
  };

  const addItemDetail = () => {
    setNewRequest({
      ...newRequest,
      item_details: [
        ...newRequest.item_details,
        {
          item_name: '',
          item_description: '',
          quantity: '',
          unit: '',
          price: '',
          currency: 'SR',
          total: '',
        },
      ],
    });
  };

  const removeItemDetail = index => {
    const updatedItemDetails = newRequest.item_details.filter(
      (_, i) => i !== index,
    );
    setNewRequest({...newRequest, item_details: updatedItemDetails});
  };

  const handleAddRequest = () => {
    if (
      newRequest.item_details.some(
        detail => !detail.item_name || !detail.quantity || !detail.price,
      )
    ) {
      Alert.alert(
        'Error',
        'Please fill in all mandatory fields for each item detail',
      );
      return;
    }

    if (isEditing) {
      const updatedRequests = [...requests];
      updatedRequests[editIndex] = newRequest;
      setRequests(updatedRequests);
      setIsEditing(false);
      setEditIndex(null);
    } else {
      setRequests([...requests, newRequest]);
    }

    setIsModalVisible(false);
    setNewRequest({
      ...newRequest,
      item_details: [
        {
          item_name: '',
          item_description: '',
          quantity: '',
          unit: '',
          price: '',
          currency: 'SR',
          total: '',
        },
      ],
    });
  };

  const handleEditRequest = index => {
    setNewRequest(requests[index]);
    setIsEditing(true);
    setEditIndex(index);
    setIsModalVisible(true);
  };

  const handleSubmitRequest = async () => {
    if (requests.length === 0) {
      Alert.alert('Error', 'No requests added');
      return;
    }

    try {
      await createMaterialsRequest(requests[0]);

      Alert.alert('Success', 'Request submitted successfully');
      setRequests([]);
      fetchDraftRequests();
      fetchSubmittedRequests();
    } catch (error) {
      let errorMessage = 'Failed to submit request. Please try again.';
      if (
        error.response &&
        error.response.data &&
        error.response.data._server_messages
      ) {
        try {
          const serverMessages = JSON.parse(
            error.response.data._server_messages,
          );
          errorMessage = serverMessages[0].message || errorMessage;
        } catch (parseError) {
          console.error("Error parsing server messages:");
        }
      }
      Alert.alert('Error', errorMessage);
    }
  };

  const handleSubmitDraftRequest = async requestId => {
    try {
      await submitDraftRequest(requestId);
      Alert.alert('Success', 'Draft request submitted successfully');
      fetchDraftRequests();
      fetchSubmittedRequests();
    } catch (error) {
      console.error("Error submitting draft request:");
      Alert.alert(
        'Error',
        error.message || 'Failed to submit draft request. Please try again.',
      );
    }
  };

  const renderRequestItem = (request, index, isDraft = false) => (
    <View key={request.name} style={styles.requestItem}>
      <Text style={styles.requestTitle}>{`Request ${request.name}`}</Text>
      <Text>{`Status: ${request.workflow_state || 'N/A'}`}</Text>
      <Text>{`Type: ${request.request_type || 'N/A'}`}</Text>
      <Text>{`Total Amount: ${request.total_amount || 'N/A'}`}</Text>
      <Text>Items:</Text>
      {Array.isArray(request.item_details) &&
        request.item_details.map((item, itemIndex) => (
          <Text key={itemIndex}>{`- ${item.item_name || 'N/A'} (${
            item.quantity || 'N/A'
          } ${item.unit || 'N/A'})`}</Text>
        ))}
      {isDraft && (
        <TouchableOpacity
          style={styles.submitDraftButton}
          onPress={() => handleSubmitDraftRequest(request.name)}>
          <Text style={styles.buttonText}>Submit</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Materials Service Request</Text>

        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => setIsDraftModalVisible(true)}>
          <Text style={styles.buttonText}>View Draft Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => setIsSubmittedModalVisible(true)}>
          <Text style={styles.buttonText}>View Submitted Requests</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Date</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateText}>{newRequest.date.toDateString()}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Request Type</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={newRequest.request_type}
            onValueChange={value => handleInputChange('request_type', value)}
            style={styles.picker}>
            <Picker.Item label="Select Request Type" value="" />
            {requestTypes.map((type, index) => (
              <Picker.Item key={index} label={type} value={type} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Request Description</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Enter request description"
          placeholderTextColor="#B0B0B0"
          value={newRequest.description_req}
          onChangeText={value => handleInputChange('description_req', value)}
          multiline
        />

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsModalVisible(true)}>
          <Text style={styles.buttonText}>Add Item Details</Text>
        </TouchableOpacity>

        <Modal
          isVisible={isModalVisible}
          onBackdropPress={() => setIsModalVisible(false)}>
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={styles.modalScrollContainer}>
              <Text style={styles.modalTitle}>Item Details</Text>

              {newRequest.item_details.map((detail, index) => (
                <View key={index} style={styles.itemDetailContainer}>
                  <Text style={styles.itemDetailTitle}>Item {index + 1}</Text>

                  <Text style={styles.label}>Item Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter item name"
                    placeholderTextColor="#B0B0B0"
                    value={detail.item_name}
                    onChangeText={value =>
                      handleItemDetailChange(index, 'item_name', value)
                    }
                  />

                  <Text style={styles.label}>Item Description</Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Enter item description"
                    placeholderTextColor="#B0B0B0"
                    value={detail.item_description}
                    onChangeText={value =>
                      handleItemDetailChange(index, 'item_description', value)
                    }
                    multiline
                  />

                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter quantity"
                    placeholderTextColor="#B0B0B0"
                    value={detail.quantity}
                    onChangeText={value =>
                      handleItemDetailChange(index, 'quantity', value)
                    }
                    keyboardType="numeric"
                  />

                  <Text style={styles.label}>Unit</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={detail.unit}
                      onValueChange={value =>
                        handleItemDetailChange(index, 'unit', value)
                      }
                      style={styles.picker}>
                      <Picker.Item label="Select Unit" value="" />
                      {unitOptions.map((unit, unitIndex) => (
                        <Picker.Item
                          key={unitIndex}
                          label={unit}
                          value={unit}
                        />
                      ))}
                    </Picker>
                  </View>

                  <Text style={styles.label}>Price</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter price"
                    placeholderTextColor="#B0B0B0"
                    value={detail.price}
                    onChangeText={value =>
                      handleItemDetailChange(index, 'price', value)
                    }
                    keyboardType="numeric"
                  />

                  <Text style={styles.label}>Currency</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={detail.currency}
                      onValueChange={value =>
                        handleItemDetailChange(index, 'currency', value)
                      }
                      style={styles.picker}>
                      <Picker.Item label="SR" value="SR" />
                    </Picker>
                  </View>

                  <Text style={styles.label}>Total</Text>
                  <TextInput
                    style={styles.input}
                    value={detail.total}
                    editable={false}
                    placeholderTextColor="#B0B0B0"
                  />

                  {index > 0 && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeItemDetail(index)}>
                      <Text style={styles.buttonText}>Remove Item</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={styles.addButton}
                onPress={addItemDetail}>
                <Text style={styles.buttonText}>Add Another Item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddRequest}>
                <Text style={styles.buttonText}>
                  {isEditing ? 'Update Request' : 'Add Request'}
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

        <Modal
          isVisible={isDraftModalVisible}
          onBackdropPress={() => setIsDraftModalVisible(false)}>
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={styles.modalScrollContainer}>
              <Text style={styles.modalTitle}>Draft Requests</Text>
              {draftRequests.map((request, index) =>
                renderRequestItem(request, index, true),
              )}
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsDraftModalVisible(false)}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        <Modal
          isVisible={isSubmittedModalVisible}
          onBackdropPress={() => setIsSubmittedModalVisible(false)}>
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={styles.modalScrollContainer}>
              <Text style={styles.modalTitle}>Submitted Requests</Text>
              {submittedRequests.length > 0 ? (
                submittedRequests.map((request, index) =>
                  renderRequestItem(request, index),
                )
              ) : (
                <Text>No submitted requests found.</Text>
              )}
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsSubmittedModalVisible(false)}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        <DateTimePickerModal
          isVisible={showDatePicker}
          mode="date"
          onConfirm={date => {
            setShowDatePicker(false);
            handleInputChange('date', date);
          }}
          onCancel={() => setShowDatePicker(false)}
        />

        <Text style={styles.label}>Added Requests</Text>
        {requests.length === 0 ? (
          <Text>No requests added</Text>
        ) : (
          requests.map((request, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleEditRequest(index)}>
              <View style={styles.requestItem}>
                <Text>{`Request ${index + 1}: ${request.request_type}`}</Text>
                <Text>{`Employee: ${request.employee}`}</Text>
                <Text>{`Total Amount: ${request.total_amount}`}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={[styles.submitButton, {marginBottom: 50}]}
          onPress={handleSubmitRequest}>
          <Text style={styles.buttonText}>Submit Request</Text>
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
    alignSelf: 'flex-start',
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
    shadowOffset: {width: 0, height: 1},
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
    shadowOffset: {width: 0, height: 1},
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
    shadowOffset: {width: 0, height: 1},
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
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  viewButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
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
    shadowOffset: {width: 0, height: 2},
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
    shadowOffset: {width: 0, height: 2},
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
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requestItem: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 8,
  },
  removeButton: {
    backgroundColor: '#FF4757',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  itemDetailContainer: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemDetailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 12,
  },
  submitDraftButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default MaterialsServiceRequestForm;
