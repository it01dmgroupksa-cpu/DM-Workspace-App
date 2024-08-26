import React, { useState, useEffect, useContext } from 'react';
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { getUserRFQs, getSalesPersonNameByEmployeeID, downloadQuotationPDF } from '../../api';
import { EmployeeContext } from '../context/EmployeeContext';

const RFQModal = ({ visible, onClose }) => {
  const [rfqs, setRFQs] = useState([]);  // Initialize as an empty array
  const { employeeDetails } = useContext(EmployeeContext);

  useEffect(() => {
    if (visible && employeeDetails) {
      fetchSalesPersonAndRFQs();
    }
  }, [visible]);

  const fetchSalesPersonAndRFQs = async () => {
    try {
      // Fetch the sales person name by employee ID
      const salesPersonName = await getSalesPersonNameByEmployeeID(employeeDetails.name);

      if (salesPersonName) {
        // Fetch RFQs by sales person name
        const rfqData = await getUserRFQs(salesPersonName);
        console.log('Fetched RFQs:', rfqData);  // Add logging
        setRFQs(rfqData || []);  // Ensure it's always an array
      } else {
        console.warn('No RFQs found for this sales person');
        setRFQs([]);  // If no RFQs, set an empty array
      }
    } catch (error) {
      console.error('Error fetching Sales Person or RFQs:', error);
      setRFQs([]);  // Handle errors by setting an empty array
    }
  };

  const downloadQuotation = async (quotationNo) => {
    try {
      const result = await downloadQuotationPDF(quotationNo);
      if (result.success) {
        console.log('Success', `PDF downloaded and saved to ${result.path}`);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      console.log('Error', 'Failed to download PDF. Please try again.');
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text>RFQ ID: {item.name}</Text>
      <Text>Date: {item.date}</Text>
      <Text>Customer: {item.customer_name}</Text>
      {item.quotation_no ? (
        <View style={styles.quotationRow}>
          <Text>Quotation: {item.quotation_no}</Text>
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={() => downloadQuotation(item.quotation_no)}
          >
            <Text style={styles.downloadButtonText}>Download</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text>No Quotation Available</Text>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>My RFQs</Text>
          {rfqs.length > 0 ? (  // Check if rfqs has data
            <FlatList
              data={rfqs}
              renderItem={renderItem}
              keyExtractor={(item) => item.name}
            />
          ) : (
            <Text>No RFQs found</Text>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 10,
  },
  quotationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  downloadButton: {
    backgroundColor: '#153156',
    padding: 5,
    borderRadius: 5,
  },
  downloadButtonText: {
    color: 'white',
  },
  closeButton: {
    marginTop: 20,
    alignSelf: 'center',
    padding: 10,
    backgroundColor: '#153156',
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
  },
});

export default RFQModal;
