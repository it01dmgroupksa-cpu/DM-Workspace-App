import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Modal from 'react-native-modal';
import { Picker } from '@react-native-picker/picker';
import { EmployeeContext } from '../context/EmployeeContext';
import { requestQuotation, getQuotations, getSuppliers, getItems, getSeriesOptions, getUOMs, getWarehouses } from '../../api';
import { useNavigation } from '@react-navigation/native'; // Import navigation

const RequestForQuotation = () => {
  const { employeeDetails } = useContext(EmployeeContext);
  const [series, setSeries] = useState('RFQ-DM-.YYYY.-');
  const [company, setCompany] = useState('Durar Masagh Trading Company');
  const [supplier, setSupplier] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [requiredDate, setRequiredDate] = useState(new Date());
  const [quantity, setQuantity] = useState('1.000000000');
  const [uom, setUom] = useState('PCS');
  const [warehouse, setWarehouse] = useState('');
  const [email, setEmail] = useState('');
  const [quotations, setQuotations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [seriesOptions, setSeriesOptions] = useState([]);
  const [uomOptions, setUomOptions] = useState([]);
  const [warehouseOptions, setWarehouseOptions] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const navigation = useNavigation(); // Use navigation

  useEffect(() => {
    if (employeeDetails) {
      fetchQuotations();
      fetchSuppliers();
      fetchItems();
      fetchSeriesOptions();
      fetchUOMOptions();
      fetchWarehouseOptions();
    }
  }, [employeeDetails]);

  const fetchQuotations = async () => {
    try {
      const requests = await getQuotations(employeeDetails.name);
      setQuotations(requests.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
      console.error('Error fetching quotations:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const supplierList = await getSuppliers();
      setSuppliers(supplierList);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchItems = async () => {
    try {
      const itemList = await getItems();
      setItems(itemList);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const fetchSeriesOptions = async () => {
    try {
      const seriesList = await getSeriesOptions();
      setSeriesOptions(seriesList);
    } catch (error) {
      console.error('Error fetching series options:', error);
    }
  };

  const fetchUOMOptions = async () => {
    try {
      const uomList = await getUOMs();
      setUomOptions(uomList);
    } catch (error) {
      console.error('Error fetching UOM options:', error);
    }
  };

  const fetchWarehouseOptions = async () => {
    try {
      const warehouseList = await getWarehouses();
      setWarehouseOptions(warehouseList);
    } catch (error) {
      console.error('Error fetching warehouse options:', error);
    }
  };

  const handleRequestQuotation = async () => {
    if (!company || !supplier || !itemCode || !requiredDate || !quantity || !uom || !email) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const newQuotationRequest = {
        series,
        company,
        supplier,
        item_code: itemCode,
        required_date: requiredDate.toISOString().split('T')[0],
        quantity,
        uom,
        email,
        warehouse,
        status: 'Draft'
      };
      await requestQuotation(newQuotationRequest);
      Alert.alert('Success', 'Quotation request submitted');
      setSeries('RFQ-DM-.YYYY.-');
      setSupplier('');
      setItemCode('');
      setRequiredDate(new Date());
      setQuantity('1.000000000');
      setUom('PCS');
      setEmail('');
      setWarehouse('DM Warehouse');
      fetchQuotations();
    } catch (error) {
      console.error('Error requesting quotation:', error);
      Alert.alert('Error', 'Failed to submit quotation request');
    }
  };

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Request for Quotation</Text>
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Series</Text>
        </View>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={series}
            onValueChange={(itemValue) => setSeries(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select Series" value="" />
            <Picker.Item label="RFQ-DM-.YYYY.-" value="RFQ-DM-.YYYY.-" />
            <Picker.Item label="RFQ-QM-.YYYY.-" value="RFQ-QM-.YYYY.-" />
            <Picker.Item label="RFQ-NS-.YYYY.-" value="RFQ-NS-.YYYY.-" />
          </Picker>
        </View>
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Company</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Company"
          placeholderTextColor="#153156"
          value={company}
          editable={false}
        />
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Required Date</Text>
        </View>
        <TouchableOpacity onPress={() => setShowDatePicker(true)}>
          <Text style={styles.input}>{`Required Date: ${requiredDate.toDateString()}`}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={requiredDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setRequiredDate(selectedDate);
              }
            }}
          />
        )}
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Supplier</Text>
        </View>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={supplier}
            onValueChange={(itemValue) => setSupplier(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select Supplier" value="" />
            {suppliers.map((sup, index) => (
              <Picker.Item key={index} label={sup.supplier_name} value={sup.name} />
            ))}
          </Picker>
        </View>
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Contact</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Contact"
          placeholderTextColor="#153156"
          value={supplier}
          onChangeText={setSupplier}
        />
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Email</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#153156"
          value={email}
          onChangeText={setEmail}
        />
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Item Code</Text>
        </View>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={itemCode}
            onValueChange={(itemValue) => setItemCode(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select Item Code" value="" />
            {items.map((item, index) => (
              <Picker.Item key={index} label={`${item.item_code} - ${item.description}`} value={item.item_code} />
            ))}
          </Picker>
        </View>
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Quantity</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Quantity"
          placeholderTextColor="#153156"
          value={quantity}
          onChangeText={setQuantity}
        />
        <View style={styles.labelContainer}>
          <Text style={styles.label}>UOM</Text>
        </View>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={uom}
            onValueChange={(itemValue) => setUom(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="PCS" value="PCS" />
            {uomOptions.map((uom, index) => (
              <Picker.Item key={index} label={uom.uom_name} value={uom.uom_name} />
            ))}
          </Picker>
        </View>
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Warehouse</Text>
        </View>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={warehouse}
            onValueChange={(itemValue) => setWarehouse(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select Warehouse" value="" />
            {warehouseOptions.map((warehouse, index) => (
              <Picker.Item key={index} label={warehouse.warehouse_name} value={warehouse.name} />
            ))}
          </Picker>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleRequestQuotation}>
          <Text style={styles.buttonText}>Request Quotation</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={toggleModal}>
          <Text style={styles.buttonText}>View Quotation Requests</Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal isVisible={isModalVisible} onBackdropPress={toggleModal}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Quotation Requests</Text>
          <ScrollView style={styles.scrollView}>
            {quotations.map((item, index) => (
              <View key={index} style={styles.requestItem}>
                <Text style={styles.requestText}>{item.item_code} - {item.quantity} {item.uom}</Text>
                <Text style={styles.requestStatus}>{item.status}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.button, styles.modalButton]} onPress={toggleModal}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.navbarButton}
          onPress={() => navigation.navigate('AttendanceManagement')}
        >
          <Text style={styles.navbarButtonText}>Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navbarButton}
          onPress={() => navigation.navigate('LeaveManagement')}
        >
          <Text style={styles.navbarButtonText}>Leave</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navbarButton}
          onPress={() => navigation.navigate('RequestForQuotation')}
        >
          <Text style={styles.navbarButtonText}>Quotation</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
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
    justifyContent: 'center',
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
  button: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
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
  labelContainer: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  label: {
    fontSize: 16,
    color: '#153156',
    fontWeight: 'bold',
  },
});

export default RequestForQuotation;