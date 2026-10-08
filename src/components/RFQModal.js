import React, { useState, useEffect, useContext, useCallback } from 'react';
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
  }, [visible, employeeDetails, fetchSalesPersonAndRFQs]);

  const fetchSalesPersonAndRFQs = useCallback(async () => {
    if (!employeeDetails?.name) {
      setRFQs([]);
      return;
    }

    try {
      const salesPersonName = await getSalesPersonNameByEmployeeID(employeeDetails.name);

      if (salesPersonName) {
        const rfqData = await getUserRFQs(salesPersonName);
        setRFQs(rfqData || []);  // Ensure it's always an array
      } else {
        console.warn("No RFQs found for this sales person");
        setRFQs([]);  // If no RFQs, set an empty array
      }
    } catch (error) {
      console.error("Error fetching Sales Person or RFQs:");
      setRFQs([]);  // Handle errors by setting an empty array
    }
  }, [employeeDetails?.name]);

  const downloadQuotation = async (quotationNo) => {
    try {
      const result = await downloadQuotationPDF(quotationNo);
      if (result.success) {

      }
    } catch (error) {
      console.error("Error downloading PDF:");

    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.itemText}>RFQ ID: {item.name}</Text>
      <Text style={styles.itemText}>Date: {item.date}</Text>
      <Text style={styles.itemText}>Customer: {item.customer_name}</Text>
      {item.quotation_no ? (
        <View style={styles.quotationRow}>
          <Text style={styles.quotationText}>Quotation: {item.quotation_no}</Text>
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={() => downloadQuotation(item.quotation_no)}
          >
            <Text style={styles.downloadButtonText}>Download</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.noQuotationText}>No Quotation Available</Text>
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
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <Text style={styles.noDataText}>No RFQs found</Text>
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
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
    textAlign: 'center',
  },
  item: {
    backgroundColor: '#F7F9FC',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemText: {
    fontSize: 16,
    color: '#153156',
    marginBottom: 4,
  },
  quotationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  quotationText: {
    fontSize: 16,
    color: '#153156',
  },
  downloadButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  noQuotationText: {
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999999',
    marginTop: 20,
  },
  closeButton: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#153156',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    paddingBottom: 20,
  },
});

export default RFQModal;
