import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { getAllItems, getItemStockByWarehouse, searchItems } from '../../api';

const ItemsStock = () => {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [warehouseStock, setWarehouseStock] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const data = await getAllItems();
      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim() === '') {
      fetchItems();
      return;
    }

    setIsLoading(true);
    try {
      const searchResults = await searchItems(searchQuery);
      setItems(searchResults);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error searching items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemClick = async (item) => {
    setSelectedItem(item);
    setIsLoading(true);
    try {
      const stockData = await getItemStockByWarehouse(item.item_code);
      setWarehouseStock(stockData);
      setIsModalVisible(true);
    } catch (error) {
      console.error('Error fetching warehouse stock:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedItem(null);
    setWarehouseStock([]);
  };

  const totalPages = Math.ceil(items.length / itemsPerPage);

  const displayedItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

  const truncateText = (text, maxLength) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Inventory List</Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.input}
            placeholder="Search items..."
            placeholderTextColor="#153156"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.buttonText}>Search</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Item Code</Text>
            <Text style={styles.tableHeaderText}>Item Name</Text>
          </View>

          {displayedItems.map((item) => (
            <TouchableOpacity
              key={item.item_code}
              style={styles.tableRow}
              onPress={() => handleItemClick(item)}
            >
              <Text style={styles.tableRowText}>{item.item_code}</Text>
              <Text style={styles.tableRowText}>{truncateText(item.item_name, 40)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[styles.paginationButton, currentPage === 1 && styles.disabledButton]}
            onPress={handlePreviousPage}
            disabled={currentPage === 1}
          >
            <Text style={styles.paginationButtonText}>Previous</Text>
          </TouchableOpacity>
          <Text style={styles.paginationText}>
            Page {currentPage} of {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.paginationButton, currentPage === totalPages && styles.disabledButton]}
            onPress={handleNextPage}
            disabled={currentPage === totalPages}
          >
            <Text style={styles.paginationButtonText}>Next</Text>
          </TouchableOpacity>
        </View>

        {isModalVisible && selectedItem && (
          <Modal
            transparent={true}
            animationType="slide"
            visible={isModalVisible}
            onRequestClose={handleCloseModal}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {selectedItem.item_code} - {selectedItem.item_name}
                </Text>
                {isLoading ? (
                  <ActivityIndicator size="large" color="#153156" />
                ) : (
                  <View>
                    {warehouseStock.map((stock) => (
                      <View key={stock.warehouse} style={styles.warehouseItem}>
                        <Text style={styles.warehouseName}>{stock.warehouse}</Text>
                        <Text style={styles.warehouseStock}>
                          {stock.stock_qty} {stock.stock_uom}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity style={styles.modalCloseButton} onPress={handleCloseModal}>
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
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
  searchContainer: {
    width: '100%',
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchButton: {
    backgroundColor: '#153156',
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
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F0F4FF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#153156',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
  },
  tableRowText: {
    flex: 1,
    fontSize: 16,
    color: '#153156',
    textAlign: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
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
  modalOverlay: {
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
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 16,
    textAlign: 'center',
  },
  warehouseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
  },
  warehouseName: {
    fontSize: 16,
    color: '#153156',
  },
  warehouseStock: {
    fontSize: 16,
    color: '#153156',
    fontWeight: 'bold',
  },
  modalCloseButton: {
    backgroundColor: '#153156',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
});

export default ItemsStock;
