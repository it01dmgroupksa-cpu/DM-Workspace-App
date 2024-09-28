import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getDMOfficialMemos, getDMOfficialMemoDetails } from '../../api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DMOfficialMemo = () => {
  const [memos, setMemos] = useState([]);
  const [selectedMemo, setSelectedMemo] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const memosPerPage = 10;
  const [webViewHeight, setWebViewHeight] = useState(100); // Dynamic WebView height

  useEffect(() => {
    fetchMemos();
  }, []);

  const fetchMemos = async () => {
    try {
      const data = await getDMOfficialMemos();
      setMemos(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching memos:', error);
      setIsLoading(false);
    }
  };

  const handleMemoClick = async (memo) => {
    setIsLoading(true);
    try {
      const memoDetails = await getDMOfficialMemoDetails(memo.name);
      setSelectedMemo(memoDetails);
      setIsModalVisible(true);
    } catch (error) {
      console.error('Error fetching memo details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedMemo(null);
  };

  const renderMemoItem = (memo) => (
    <TouchableOpacity 
      style={styles.tableRow} 
      onPress={() => handleMemoClick(memo)}
      key={memo.name}
    >
      <Text style={styles.tableRowText}>{memo.memo_date}</Text>
      <Text style={[styles.tableRowText, styles.memoFromColumn]} numberOfLines={2} ellipsizeMode="tail">
        {memo.memo_to}
      </Text>
    </TouchableOpacity>
  );

  const totalPages = Math.ceil(memos.length / memosPerPage);

  const displayedMemos = memos.slice(
    (currentPage - 1) * memosPerPage,
    currentPage * memosPerPage
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

  // Function to dynamically adjust WebView height based on content
  const onWebViewMessage = (event) => {
    const { height } = JSON.parse(event.nativeEvent.data);
    if (height !== webViewHeight) {
      setWebViewHeight(height); // Set the webview height dynamically
    }
  };

  const renderHtmlContent = (content) => {
    if (!content) return <Text>No content available</Text>;
    const htmlContent = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; font-size: 16px; color: #333; padding: 10px; margin: 0; }
            img { max-width: 100%; height: auto; }
          </style>
          <script>
            window.onload = function() {
              const height = document.body.scrollHeight;
              window.ReactNativeWebView.postMessage(JSON.stringify({ height }));
            };
          </script>
        </head>
        <body>${content}</body>
      </html>
    `;
    return (
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={{ height: webViewHeight }} // Dynamic height based on content
        scrollEnabled={false} // Disable scrolling in WebView itself
        onMessage={onWebViewMessage} // Use onMessage to get the height of the WebView content
      />
    );
  };

  const MemoModal = () => (
    <Modal
      transparent={true}
      visible={isModalVisible}
      animationType="fade"
      onRequestClose={handleCloseModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView contentContainerStyle={styles.modalScrollContainer}>
            <Text style={styles.modalTitle}>Memo Details</Text>
            {selectedMemo && (
              <View style={styles.infoContainer}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Memo ID:</Text>
                  <Text style={styles.infoValue}>{selectedMemo.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date:</Text>
                  <Text style={styles.infoValue}>{selectedMemo.memo_date}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>From:</Text>
                  <Text style={styles.infoValue}>{selectedMemo.memo_to}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>To:</Text>
                  <Text style={styles.infoValue}>{selectedMemo.issued_by}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Subject:</Text>
                  <Text style={styles.infoValue}>{selectedMemo.memo_subject}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Type:</Text>
                  <Text style={styles.infoValue}>{selectedMemo.memo_type}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Category:</Text>
                  <Text style={styles.infoValue}>{selectedMemo.memo_catagory}</Text>
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>Memo Content</Text>
            {selectedMemo && (
              <View style={[styles.memoContentContainer]}>
                {renderHtmlContent(selectedMemo.memo_details)}
              </View>
            )}

            {selectedMemo && selectedMemo.memo_end && (
              <>
                <Text style={styles.sectionTitle}>Memo End</Text>
                <View style={[styles.memoContentContainer]}>
                  {renderHtmlContent(selectedMemo.memo_end)}
                </View>
              </>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#153156" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>DM Official Memo</Text>

      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>Date</Text>
          <Text style={[styles.tableHeaderText, styles.memoFromColumn]}>From</Text>
        </View>
        {displayedMemos.map((memo) => renderMemoItem(memo))}
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

      <MemoModal />
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
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
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
  memoFromColumn: {
    flex: 2,
    paddingHorizontal: 5,
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
    alignSelf: 'center',
    marginTop: 50,
    marginBottom: 50,
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
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 16,
  },
  memoContentContainer: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
});

export default DMOfficialMemo;
