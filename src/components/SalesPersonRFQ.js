import React, {useState, useContext, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import Modal from 'react-native-modal';
import {Dropdown} from 'react-native-element-dropdown';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import {EmployeeContext} from '../context/EmployeeContext';
import {
  getCustomers,
  getItemsList,
  submitSalesPersonRFQ,
  getSalesPersonNameByEmployeeID,
  getUOMs,
} from '../../api';
import RFQModal from './RFQModal';

const SalesPersonRFQ = () => {
  const {employeeDetails} = useContext(EmployeeContext);
  const [customerName, setCustomerName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([{item: '', quantity: '', uom: ''}]);
  const [customers, setCustomers] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [uomOptions, setUomOptions] = useState([]);
  const [date, setDate] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false); // For item modal
  const [rfqModalVisible, setRFQModalVisible] = useState(false); // For RFQModal
  const [salesPersonName, setSalesPersonName] = useState('');
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isItemModalVisible, setItemModalVisible] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(null);
  const [pricingSpecifications, setPricingSpecifications] = useState('');

  useEffect(() => {
    fetchSalesPersonName();
    fetchCustomers();
    fetchItemsList();
    fetchUOMOptions();
  }, []);

  const fetchSalesPersonName = async () => {
    try {
      const name = await getSalesPersonNameByEmployeeID(employeeDetails.name);
      setSalesPersonName(name || '');
    } catch (error) {
      console.error('Error fetching Sales Person name:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const customerList = await getCustomers();
      setCustomers(customerList);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchItemsList = async () => {
    try {
      const itemList = await getItemsList();
      setItemsList(itemList);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const fetchUOMOptions = async () => {
    try {
      const uoms = await getUOMs();
      setUomOptions(uoms);
    } catch (error) {
      console.error('Error fetching UOMs:', error);
    }
  };

  const handleAddItem = () => {
    setItems([...items, {item: '', quantity: '', uom: ''}]);
  };

  const handleRemoveItem = index => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    setItems(updatedItems);
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    if (updatedItems[index]) {
      updatedItems[index][field] = value;
      setItems(updatedItems);
    }
  };

  const handleSubmit = async () => {
    if (!salesPersonName) {
      Alert.alert('Error', 'Unable to fetch Sales Person name.');
      return;
    }

    // Validate items
    const invalidItems = items.filter(
      item => !item.item || !item.quantity || !item.uom,
    );
    if (invalidItems.length > 0) {
      Alert.alert('Error', 'Please fill in all fields for each item.');
      return;
    }

    try {
      const newRFQ = {
        doctype: 'Sales Person RFQ',
        sales_person: salesPersonName,
        branch: employeeDetails.branch,
        customer_name: customerName,
        remarks: remarks,
        pricing_specifcations: pricingSpecifications,
        date: date.toISOString().split('T')[0],
        items: items.map(item => ({
          item_code: item.item,
          qty: parseFloat(item.quantity).toFixed(2),
          uom: item.uom,
        })),
        status: 'Draft',
      };

      console.log('Submitting RFQ:', newRFQ);
      await submitSalesPersonRFQ(newRFQ);
      Alert.alert('Success', 'Sales Person RFQ submitted');
      setCustomerName('');
      setRemarks('');
      setPricingSpecifications('');
      setItems([{item: '', quantity: '', uom: ''}]);
    } catch (error) {
      console.error('Error submitting Sales Person RFQ:', error);
      Alert.alert('Error', 'Failed to submit Sales Person RFQ');
    }
  };

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = selectedDate => {
    setDate(selectedDate);
    hideDatePicker();
  };

  const openItemModal = index => {
    setCurrentItemIndex(index);
    setItemModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Sales Person RFQ</Text>

        <Text style={styles.label}>Date</Text>
        <TouchableOpacity style={styles.input} onPress={showDatePicker}>
          <Text style={styles.dateText}>{date.toDateString()}</Text>
        </TouchableOpacity>

        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirm}
          onCancel={hideDatePicker}
        />

        <Text style={styles.label}>Customer Name</Text>
        <Dropdown
          style={[styles.input, styles.dropdown]}
          placeholderStyle={styles.placeholderStyle}
          selectedTextStyle={styles.selectedTextStyle}
          inputSearchStyle={styles.inputSearchStyle}
          iconStyle={styles.iconStyle}
          data={customers.map(customer => ({
            label: customer.customer_name,
            value: customer.customer_name,
          }))}
          search
          maxHeight={300}
          labelField="label"
          valueField="value"
          placeholder="Select Customer"
          searchPlaceholder="Search..."
          value={customerName}
          onChange={item => {
            setCustomerName(item.value);
          }}
        />

        <Text style={styles.label}>Remarks</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Enter any remarks"
          placeholderTextColor="#B0B0B0"
          value={remarks}
          onChangeText={setRemarks}
          multiline
        />

        <Text style={styles.label}>Pricing Specifications</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Enter pricing specifications"
          placeholderTextColor="#B0B0B0"
          value={pricingSpecifications}
          onChangeText={setPricingSpecifications}
          multiline
        />

        <Text style={styles.label}>Items</Text>
        {items.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.itemContainer}
            onPress={() => openItemModal(index)}>
            <Text style={styles.itemTitle}>Item {index + 1}</Text>
            <Text>{`Item: ${item.item || 'Not selected'}`}</Text>
            <Text>{`Quantity: ${item.quantity || 'Not set'}`}</Text>
            <Text>{`UOM: ${item.uom || 'Not selected'}`}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
          <Text style={styles.buttonText}>Add Item</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Submit RFQ</Text>
        </TouchableOpacity>

        {/* Linking the View My RFQ to the RFQModal */}
        <TouchableOpacity
          style={styles.viewRFQButton}
          onPress={() => setRFQModalVisible(true)}>
          <Text style={styles.buttonText}>View My RFQs</Text>
        </TouchableOpacity>

        <Modal
          isVisible={isItemModalVisible}
          onBackdropPress={() => setItemModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Item Details</Text>

            <Text style={styles.label}>Item</Text>
            <Dropdown
              style={[styles.input, styles.dropdown]}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={itemsList.map(item => ({
                label: `${item.item_code} - ${item.item_name}`, // Display both item_name and item_code
                value: item.name,
                searchKey: `${item.item_name.toLowerCase()} ${item.item_code.toLowerCase()}`, // Combined searchable string
              }))}
              search
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder="Select Item"
              searchPlaceholder="Search by name or code..."
              value={
                currentItemIndex !== null ? items[currentItemIndex]?.item : ''
              }
              onChange={item => {
                handleItemChange(currentItemIndex, 'item', item.value);
              }}
              searchFunction={(text, item) => {
                const lowerText = text.toLowerCase();
                return item.searchKey.includes(lowerText);
              }}
            />

            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter quantity"
              placeholderTextColor="#B0B0B0"
              value={
                currentItemIndex !== null
                  ? items[currentItemIndex]?.quantity
                  : ''
              }
              onChangeText={value =>
                handleItemChange(currentItemIndex, 'quantity', value)
              }
              keyboardType="numeric"
            />

            <Text style={styles.label}>UOM</Text>
            <Dropdown
              style={[styles.input, styles.dropdown]}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={uomOptions.map(uom => ({
                label: uom.uom_name,
                value: uom.uom_name,
              }))}
              search
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder="Select UOM"
              searchPlaceholder="Search..."
              value={
                currentItemIndex !== null ? items[currentItemIndex]?.uom : ''
              }
              onChange={item => {
                handleItemChange(currentItemIndex, 'uom', item.value);
              }}
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => setItemModalVisible(false)}>
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>

            {currentItemIndex > 0 && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => {
                  handleRemoveItem(currentItemIndex);
                  setItemModalVisible(false);
                }}>
                <Text style={styles.buttonText}>Remove Item</Text>
              </TouchableOpacity>
            )}
          </View>
        </Modal>

        {/* Add RFQModal for Viewing RFQs */}
        <RFQModal
          visible={rfqModalVisible}
          onClose={() => setRFQModalVisible(false)}
        />
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
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#153156',
  },
  textArea: {
    width: '100%',
    height: 100,
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E7FF',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    fontSize: 16,
    color: '#153156',
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E7FF',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 8,
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
  submitButton: {
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
  viewRFQButton: {
    backgroundColor: '#4CAF50',
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
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
    shadowOffset: {width: 0, height: 1},
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
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#153156',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  removeButton: {
    backgroundColor: '#FF4757',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default SalesPersonRFQ;
