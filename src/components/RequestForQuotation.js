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
      quantity: '',
      uom: '',
      warehouse: '',
      requiredDate: new Date(),
      showDatePicker: false,
      conversion_factor: 1, // Default conversion factor is set to 1
      description: '',
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
      console.error("Error fetching suppliers:");
    }
  };

  const fetchItems = async () => {
    try {
      const items = await getItemsList();
      setItemList(items);
    } catch (error) {
      console.error("Error fetching items:");
    }
  };

  const fetchUOMOptions = async () => {
    try {
      const uoms = await getUOMs();
      setUomOptions(uoms);
    } catch (error) {
      console.error("Error fetching UOMs:");
    }
  };

  const fetchWarehouseOptions = async () => {
    try {
      const warehouses = await getWarehouses();
      setWarehouseOptions(warehouses);
    } catch (error) {
      console.error("Error fetching warehouses:");
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
        conversion_factor: 1, // Always initialize with a default conversion factor
      },
    ]);
  };

  const handleRemoveItemRow = index => {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
  };

  const handleRequestQuotation = async () => {
    if (suppliers.some(s => !s.supplier || !s.email)) {
      Alert.alert('Error', 'Please fill in all supplier fields');
      return;
    }

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
          conversion_factor: item.conversion_factor || 1, // Ensure conversion factor is always set
          required_date: item.requiredDate.toISOString().split('T')[0],
          description: 'N/A',
        })),
        required_date: date.toISOString().split('T')[0],
        status: 'Draft',
        message_for_supplier: 'N/A',
      };



      await requestQuotation(newQuotationRequest);
      Alert.alert('Success', 'Quotation request submitted');
      resetForm();
    } catch (error) {
      console.error("Error requesting quotation:");
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
        conversion_factor: 1, // Reset conversion factor
      },
    ]);
    setDate(new Date());
  };

  const handleDateChange = (index, event, selectedDate) => {
    const currentDate = selectedDate || items[index].requiredDate;
    const updatedItems = [...items];
    updatedItems[index].requiredDate = currentDate;
    updatedItems[index].showDatePicker = false;
    setItems(updatedItems);
  };

  const openDatePicker = index => {
    const updatedItems = [...items];
    updatedItems[index].showDatePicker = true;
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
                label: `${i.item_code} - ${i.item_name} `, // Display both item_name and item_code
                value: i.item_code,
                searchKey: `${i.item_name.toLowerCase()} ${i.item_code.toLowerCase()}`, // Combined searchable string
              }))}
              search
              searchPlaceholder="Search by name or code..."
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
              searchFunction={(text, item) => {
                const lowerText = text.toLowerCase();
                return item.searchKey.includes(lowerText); // Custom search logic
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
                updatedItems[index].warehouse = selectedWarehouse.value;
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
    backgroundColor: '#F5F7FA',
  },
  scrollContainer: {
    flexGrow: 1,
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
    color: '#153156',
    marginBottom: 10,
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#153156',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 16,
    color: '#153156',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dateText: {
    fontSize: 16,
    color: '#153156',
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
  removeButton: {
    backgroundColor: '#FF4757',
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
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dropdown: {
    height: 50,
    borderColor: '#153156',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
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
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F7F9FC',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default RequestForQuotation;
