import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Dropdown } from 'react-native-element-dropdown';
import { EmployeeContext } from '../context/EmployeeContext';
import { getBranches, getCustomers, getItemsList, submitSalesPersonRFQ, getSalesPersonNameByEmployeeID } from '../../api';  // Add getSalesPersonNameByEmployeeID
import RFQModal from './RFQModal';

const SalesPersonRFQ = () => {
  const { employeeDetails } = useContext(EmployeeContext);
  const [branch, setBranch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [items, setItems] = useState([{ item: '', quantity: '' }]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [salesPersonName, setSalesPersonName] = useState('');  // New state to hold the sales person's name

  useEffect(() => {
    fetchSalesPersonName();  // Fetch the sales person's name
    fetchBranches();
    fetchCustomers();
    fetchItemsList();
  }, []);

  const fetchSalesPersonName = async () => {
    try {
      // Fetch the sales person name by employee ID
      const name = await getSalesPersonNameByEmployeeID(employeeDetails.name);
      if (name) {
        setSalesPersonName(name);
      } else {
        console.warn('No sales person found for this employee');
        setSalesPersonName('');
      }
    } catch (error) {
      console.error('Error fetching Sales Person name:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const branchList = await getBranches();
      setBranches(branchList);
    } catch (error) {
      console.error('Error fetching branches:', error);
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

  const handleAddRow = () => {
    setItems([...items, { item: '', quantity: '' }]);
  };

  const handleRemoveRow = (index) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    setItems(updatedItems);
  };

  const handleItemChange = (index, value) => {
    const updatedItems = [...items];
    updatedItems[index].item = value;
    setItems(updatedItems);
  };

  const handleQuantityChange = (index, value) => {
    const updatedItems = [...items];
    updatedItems[index].quantity = value;
    setItems(updatedItems);
  };

  const handleSubmit = async () => {
    if (!salesPersonName) {
      Alert.alert('Error', 'Unable to fetch Sales Person name.');
      return;
    }

    if (items.some(i => !i.item || !i.quantity)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const newRFQ = {
        doctype: 'Sales Person RFQ',
        sales_person: salesPersonName,  // Use salesPersonName here
        branch: branch,
        customer_name: customerName,
        date: date.toISOString().split('T')[0], // Format date as YYYY-MM-DD
        items: items.map(item => ({
          item_code: item.item,
          qty: parseFloat(item.quantity).toFixed(2),
        })),
        status: 'Draft',
      };

      console.log('Submitting RFQ:', newRFQ);
      await submitSalesPersonRFQ(newRFQ);
      Alert.alert('Success', 'Sales Person RFQ submitted');
      setBranch('');
      setCustomerName('');
      setItems([{ item: '', quantity: '' }]);
      setDate(new Date());
    } catch (error) {
      console.error('Error submitting Sales Person RFQ:', error.response ? error.response.data : error.message);
      Alert.alert('Error', 'Failed to submit Sales Person RFQ');
    }
  };

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(false);
    setDate(currentDate);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Sales Person RFQ</Text>

        <Text style={styles.label}>Date</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateText}>{date.toDateString()}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        <Text style={styles.label}>Branch</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={branch}
            onValueChange={(itemValue) => setBranch(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select Branch" value="" />
            {branches.map((branch, index) => (
              <Picker.Item key={index} label={branch.branch} value={branch.branch} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Customer Name</Text>
        <Dropdown
          style={styles.dropdown}
          placeholderStyle={styles.placeholderStyle}
          selectedTextStyle={styles.selectedTextStyle}
          inputSearchStyle={styles.inputSearchStyle}
          iconStyle={styles.iconStyle}
          data={customers.map((customer) => ({
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

        {items.map((item, index) => (
          <View key={index} style={styles.itemRowbg}>
            <Text style={styles.label}>Item</Text>
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={itemsList.map((listItem) => ({
                label: listItem.item_name,
                value: listItem.name,
              }))}
              search
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder="Select Item"
              searchPlaceholder="Search..."
              value={item.item}
              onChange={selectedItem => {
                handleItemChange(index, selectedItem.value);
              }}
            />

            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              placeholder="Quantity"
              placeholderTextColor="#153156"
              value={item.quantity}
              onChangeText={(value) => handleQuantityChange(index, value)}
              keyboardType="numeric"
            />
            {index > 0 && (
              <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveRow(index)}>
                <Text style={styles.buttonText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={handleAddRow}>
          <Text style={styles.buttonText}>Add Row</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Submit RFQ</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.viewRFQButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.buttonText}>View My RFQs</Text>
        </TouchableOpacity>

        <RFQModal visible={modalVisible} onClose={() => setModalVisible(false)} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
    textAlign: 'center',
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
  dateText: {
    fontSize: 16,
    color: '#153156',
  },
  itemRowbg: {
    width: '100%',
    marginBottom: 20,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  addButton: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  removeButton: {
    backgroundColor: '#E53935',
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  viewRFQButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
});

export default SalesPersonRFQ;
