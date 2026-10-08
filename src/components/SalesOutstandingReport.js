import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { EmployeeContext } from '../context/EmployeeContext';
import {
  getSalesPersonNameByEmployeeID,
  getUnpaidOverdueInvoices,
  searchInvoicesByCustomer,
  getInvoiceDetails,
} from '../../api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const InvoiceModal = ({ isVisible, onClose, invoice }) => {
  if (!invoice) return null;

  return (
    <Modal
      transparent={true}
      visible={isVisible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView contentContainerStyle={styles.modalScrollContainer}>
            <Text style={styles.modalTitle}>Invoice Details</Text>
            <View style={styles.infoContainer}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Invoice ID:</Text>
                <Text style={styles.infoValue}>{invoice.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Customer:</Text>
                <Text style={[styles.infoValue, styles.customerName]} numberOfLines={3} ellipsizeMode="tail">
                  {invoice.customer}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date:</Text>
                <Text style={styles.infoValue}>{invoice.posting_date}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status:</Text>
                <Text style={[styles.infoValue, styles[invoice.status.toLowerCase()]]}>
                  {invoice.status}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total:</Text>
                <Text style={styles.infoValue}>{invoice.total} SAR</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Outstanding:</Text>
                <Text style={styles.infoValue}>{invoice.outstanding_amount} SAR</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Items</Text>
            {invoice.items && invoice.items.length > 0 ? (
              <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Item Code</Text>
                  <Text style={styles.tableHeaderCell}>Qty</Text>
                  <Text style={styles.tableHeaderCell}>Rate</Text>
                  <Text style={styles.tableHeaderCell}>UOM</Text>
                </View>
                {invoice.items.map((item, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1} ellipsizeMode="tail">
                      {item.item_code}
                    </Text>
                    <Text style={styles.tableCell}>{item.qty}</Text>
                    <Text style={styles.tableCell}>{item.rate}</Text>
                    <Text style={styles.tableCell}>{item.uom}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noItemsText}>No items found.</Text>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const SalesOutstandingReport = () => {
  const { employeeDetails } = useContext(EmployeeContext);
  const [salesPersonName, setSalesPersonName] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0); 
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const invoicesPerPage = 10;

  const calculateTotalOutstanding = useCallback((invoiceList) => {
    const total = invoiceList.reduce(
      (sum, invoice) => sum + parseFloat(invoice.outstanding_amount || 0),
      0,
    );
    setTotalOutstanding(total);
  }, []);

  const fetchInvoices = useCallback(async salesPerson => {
    setIsLoading(true);
    try {
      const data = await getUnpaidOverdueInvoices(salesPerson);
      setInvoices(data);
      calculateTotalOutstanding(data);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error fetching invoices:");
    } finally {
      setIsLoading(false);
    }
  }, [calculateTotalOutstanding]);

  const fetchSalesPerson = useCallback(async () => {
    if (!employeeDetails?.name) {
      return;
    }

    try {
      setIsLoading(true);
      const name = await getSalesPersonNameByEmployeeID(employeeDetails.name);
      setSalesPersonName(name);
      await fetchInvoices(name);
    } catch (error) {
      console.error("Error fetching salesperson:");
    } finally {
      setIsLoading(false);
    }
  }, [employeeDetails?.name, fetchInvoices]);

  useEffect(() => {
    fetchSalesPerson();
  }, [fetchSalesPerson]);

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const searchResults = await searchInvoicesByCustomer(salesPersonName, searchQuery);
      setInvoices(searchResults);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error searching invoices:");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvoiceClick = async (invoice) => {
    setIsLoading(true);
    try {
      const invoiceDetails = await getInvoiceDetails(invoice.name);
      setSelectedInvoice(invoiceDetails);
      setIsModalVisible(true);
    } catch (error) {
      console.error("Error fetching invoice details:");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedInvoice(null);
  };

  const renderInvoiceItem = ({ item }) => (
    <TouchableOpacity style={styles.tableRow} onPress={() => handleInvoiceClick(item)}>
      <Text style={styles.tableRowText}>{item.posting_date}</Text>
      <Text style={[styles.tableRowText, styles.customerColumn]} numberOfLines={3} ellipsizeMode="tail">
        {item.customer}
      </Text>
      <Text style={styles.tableRowText}>{item.outstanding_amount}</Text>
      <Text style={[styles.tableRowText, item.status === 'Overdue' ? styles.overdue : styles.unpaid]}>
        {item.status}
      </Text>
    </TouchableOpacity>
  );

  const totalPages = Math.ceil(invoices.length / invoicesPerPage);

  const displayedInvoices = invoices.slice(
    (currentPage - 1) * invoicesPerPage,
    currentPage * invoicesPerPage
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

   return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sales Outstanding Report</Text>

      <TextInput
        style={styles.input}
        placeholder="Search by customer..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
        <Text style={styles.buttonText}>Search</Text>
      </TouchableOpacity>

      <View style={styles.totalContainer}>
        <Text style={styles.totalText}>Total Outstanding: {totalOutstanding.toFixed(2)} SAR</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#153156" />
      ) : (
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Date</Text>
            <Text style={[styles.tableHeaderText, styles.customerColumn]}>Customer</Text>
            <Text style={styles.tableHeaderText}>Outstanding</Text>
            <Text style={styles.tableHeaderText}>Status</Text>
          </View>
          {displayedInvoices.map((item) => renderInvoiceItem({ item }))}
        </View>
      )}

      <View style={styles.paginationContainer}>
        <TouchableOpacity
          style={[
            styles.paginationButton,
            currentPage === 1 && styles.disabledButton,
          ]}
          onPress={handlePreviousPage}
          disabled={currentPage === 1}
        >
          <Text style={styles.paginationButtonText}>Previous</Text>
        </TouchableOpacity>
        <Text style={styles.paginationText}>
          Page {currentPage} of {totalPages}
        </Text>
        <TouchableOpacity
          style={[
            styles.paginationButton,
            currentPage === totalPages && styles.disabledButton,
          ]}
          onPress={handleNextPage}
          disabled={currentPage === totalPages}
        >
          <Text style={styles.paginationButtonText}>Next</Text>
        </TouchableOpacity>
      </View>

      <InvoiceModal
        isVisible={isModalVisible}
        onClose={handleCloseModal}
        invoice={selectedInvoice}
      />
    </ScrollView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 30,
    textAlign: 'center',
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
  },
  searchButton: {
    backgroundColor: '#153156',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#153156',
    textAlign: 'center',
  },
  tableRowText: {
    flex: 1,
    fontSize: 16,
    color: '#153156',
    textAlign: 'center',
  },
  customerColumn: {
    flex: 2,
    paddingHorizontal: 5,
  },
  unpaid: {
    color: '#FFA500',
  },
  overdue: {
    color: '#FF0000',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalScrollContainer: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 24,
    textAlign: 'center',
  },
  infoContainer: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: '#153156',
    fontWeight: '600',
    textAlign: 'right',
    flex: 2,
  },
  customerName: {
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 16,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F0F4FF',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#153156',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E7FF',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableCell: {
    flex: 1,
    fontSize: 16,
    color: '#153156',
    textAlign: 'center',
  },
  noItemsText: {
    fontSize: 16,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: '#153156',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 50,
  },
  paginationButton: {
    backgroundColor: '#153156',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 10,
  },
  paginationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paginationText: {
    fontSize: 16,
    color: '#153156',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  totalContainer: {
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#E6EAF0',
    borderRadius: 8,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#153156',
  },
});

export default SalesOutstandingReport;