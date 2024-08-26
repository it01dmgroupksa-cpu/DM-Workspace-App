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
import {Dropdown} from 'react-native-element-dropdown';
import DateTimePicker from '@react-native-community/datetimepicker';
import {EmployeeContext} from '../context/EmployeeContext';
import {
  getSuppliers,
  getItemsList,
  getUOMs,
  getWarehouses,
  requestQuotation,
} from '../../api';

const RequestForQuotation = () => {
  const {employeeDetails} = useContext(EmployeeContext);
  const [suppliers, setSuppliers] = useState([
    {supplier: '', contact: '', email: ''},
  ]);
  const [items, setItems] = useState([
    {
      itemCode: '',
      quantity: '0.000000000',
      uom: '',
      warehouse: '',
      requiredDate: new Date(),
      showDatePicker: false,
      conversion_factor: 1,  // Default conversion factor is 1
    },
  ]);
  
  const [date, setDate] = useState(new Date());
  const [series, setSeries] = useState('RFQ-DM-.YYYY.-');
  const [company, setCompany] = useState('Durar Masagh Trading Company');
  const [supplierList, setSupplierList] = useState([]);
  const [itemList, setItemList] = useState([]);
  const [uomOptions, setUomOptions] = useState([]);
  const [warehouseOptions, setWarehouseOptions] = useState([]);

  useEffect(() => {
    fetchSuppliers();
    fetchItems();
    fetchUOMOptions();
    fetchWarehouseOptions();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const suppliers = await getSuppliers();
      setSupplierList(suppliers);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchItems = async () => {
    try {
      const items = await getItemsList();
      setItemList(items);
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

  const fetchWarehouseOptions = async () => {
    try {
      const warehouses = await getWarehouses();
      setWarehouseOptions(warehouses);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const handleAddSupplierRow = () => {
    setSuppliers([...suppliers, {supplier: '', contact: '', email: ''}]);
  };

  const handleRemoveSupplierRow = index => {
    const updatedSuppliers = suppliers.filter((_, i) => i !== index);
    setSuppliers(updatedSuppliers);
  };

  const handleAddItemRow = () => {
    setItems([
      ...items,
      {
        itemCode: '',
        quantity: '',
        uom: '',
        warehouse: '',
        requiredDate: new Date(),
        showDatePicker: false,
      },
    ]);
  };

  const handleRemoveItemRow = index => {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
  };

  const handleRequestQuotation = async () => {
    console.log('Items before submission:', items);

    // Validation for suppliers
    if (suppliers.some(s => !s.supplier || !s.email)) {
      Alert.alert('Error', 'Please fill in all supplier fields');
      return;
    }

    // Validation for items
    if (
      items.some(
        item =>
          !item.itemCode ||
          !item.quantity ||
          parseFloat(item.quantity) === 0 ||
          !item.warehouse,
      )
    ) {
      Alert.alert(
        'Error',
        'Please ensure all items have a valid item code, quantity, and warehouse',
      );
      return;
    }

    try {
      const newQuotationRequest = {
        series,
        company,
        suppliers,
        items: items.map(item => ({
          item_code: item.itemCode,
          qty: item.quantity,
          uom: item.uom,
          warehouse: item.warehouse,
          conversion_factor: item.conversion_factor,  // Pass conversion factor
          required_date: item.requiredDate.toISOString().split('T')[0],
        })),
        required_date: date.toISOString().split('T')[0],
        status: 'Draft',
      };

      console.log('Request Data:', newQuotationRequest);

      await requestQuotation(newQuotationRequest);
      Alert.alert('Success', 'Quotation request submitted');
      resetForm();
    } catch (error) {
      console.error('Error requesting quotation:', error);
      Alert.alert('Error', 'Failed to submit quotation request');
    }
  };

  const resetForm = () => {
    setSeries('RFQ-DM-.YYYY.-');
    setSuppliers([{supplier: '', contact: '', email: ''}]);
    setItems([
      {
        itemCode: '',
        quantity: '',
        uom: '',
        warehouse: '',
        requiredDate: new Date(),
        showDatePicker: false,
      },
    ]);
    setDate(new Date());
  };

  const handleDateChange = (index, event, selectedDate) => {
    const currentDate = selectedDate || items[index].requiredDate;
    const updatedItems = [...items];
    updatedItems[index].requiredDate = currentDate;
    updatedItems[index].showDatePicker = false; // Close the date picker after selection
    setItems(updatedItems);
  };

  const openDatePicker = index => {
    const updatedItems = [...items];
    updatedItems[index].showDatePicker = true; // Open the date picker for specific item
    setItems(updatedItems);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Purchase RFQ</Text>

        <Text style={styles.label}>Series</Text>
        <TextInput style={styles.input} value={series} editable={false} />

        <Text style={styles.label}>Company</Text>
        <TextInput style={styles.input} value={company} editable={false} />

        <Text style={styles.label}>Required Date</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setDate(new Date())}>
          <Text style={styles.dateText}>{date.toDateString()}</Text>
        </TouchableOpacity>

        {suppliers.map((supplier, index) => (
          <View key={index} style={styles.itemRowbg}>
            <Text style={styles.label}>Supplier</Text>
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={supplierList.map(s => ({
                label: s.supplier_name,
                value: s.name,
              }))}
              search
              searchPlaceholder="Search..."
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder="Select Supplier"
              value={supplier.supplier}
              onChange={item => {
                const updatedSuppliers = [...suppliers];
                updatedSuppliers[index].supplier = item.value;
                setSuppliers(updatedSuppliers);
              }}
            />
            <TextInput
              style={styles.input}
              placeholder="Contact"
              value={supplier.contact}
              onChangeText={text => {
                const updatedSuppliers = [...suppliers];
                updatedSuppliers[index].contact = text;
                setSuppliers(updatedSuppliers);
              }}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={supplier.email}
              onChangeText={text => {
                const updatedSuppliers = [...suppliers];
                updatedSuppliers[index].email = text;
                setSuppliers(updatedSuppliers);
              }}
            />
            {index > 0 && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveSupplierRow(index)}>
                <Text style={styles.buttonText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddSupplierRow}>
          <Text style={styles.buttonText}>Add Supplier</Text>
        </TouchableOpacity>

        {items.map((item, index) => (
          <View key={index} style={styles.itemRowbg}>
            <Text style={styles.label}>Item</Text>
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={itemList.map(i => ({
                label: i.item_name,
                value: i.item_code,
              }))}
              search
              searchPlaceholder="Search..."
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder="Select Item"
              value={item.itemCode}
              onChange={selectedItem => {
                const updatedItems = [...items];
                updatedItems[index].itemCode = selectedItem.value;
                setItems(updatedItems);
              }}
            />
            <TextInput
              style={styles.input}
              placeholder="Quantity"
              value={item.quantity}
              onChangeText={text => {
                const updatedItems = [...items];
                updatedItems[index].quantity = text;
                setItems(updatedItems);
              }}
              keyboardType="numeric"
            />
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={uomOptions.map(u => ({
                label: u.uom_name,
                value: u.uom_name,
              }))}
              search
              searchPlaceholder="Search..."
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder="Select UOM"
              value={item.uom}
              onChange={selectedUom => {
                const updatedItems = [...items];
                updatedItems[index].uom = selectedUom.value;
                setItems(updatedItems);
              }}
            />
            <Dropdown
              style={styles.dropdown}
              data={warehouseOptions.map(w => ({
                label: w.warehouse_name,
                value: w.name,
              }))}
              labelField="label"
              valueField="value"
              placeholder="Select Warehouse"
              value={item.warehouse}
              onChange={selectedWarehouse => {
                const updatedItems = [...items];
                updatedItems[index].warehouse =
                  selectedWarehouse.value || 'Default Warehouse'; // Ensure warehouse is not undefined
                console.log('Updated Item:', updatedItems[index]);
                setItems(updatedItems);
              }}
            />

            <TouchableOpacity
              style={styles.input}
              onPress={() => openDatePicker(index)}>
              <Text>{item.requiredDate.toDateString()}</Text>
            </TouchableOpacity>

            {item.showDatePicker && (
              <DateTimePicker
                value={item.requiredDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) =>
                  handleDateChange(index, event, selectedDate)
                }
              />
            )}

            {index > 0 && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveItemRow(index)}>
                <Text style={styles.buttonText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={handleAddItemRow}>
          <Text style={styles.buttonText}>Add Item</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleRequestQuotation}>
          <Text style={styles.buttonText}>Submit Quotation</Text>
        </TouchableOpacity>
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
  dateText: {
    fontSize: 16,
    color: '#153156',
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
  itemRowbg: {
    width: '100%',
    marginBottom: 20,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
});

export default RequestForQuotation;
