import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
  Linking,
  Image,
  ActivityIndicator,
} from 'react-native';
import Modal from 'react-native-modal';
import {CameraView, useCameraPermissions} from 'expo-camera';
import {EmployeeContext} from '../context/EmployeeContext';
import {
  getAssignedDeliveryTrips,
  getDeliveryStops,
  updateDeliveryTripStatus,
  updateCustomDeliveredTime,
  uploadImageToImgur,
  updateSignedDeliveryNotes,
} from '../../api';
import moment from 'moment';

const DeliveryTrip = () => {
  const {employeeDetails} = useContext(EmployeeContext);
  const [deliveryTrips, setDeliveryTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [deliveredTripsModalVisible, setDeliveredTripsModalVisible] =
    useState(false);
  const [viewDeliveredModalVisible, setViewDeliveredModalVisible] =
    useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [capturedImages, setCapturedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const cameraRef = useRef(null);

  const openCamera = async () => {
    try {
      const permission = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();

      if (!permission.granted) {
        Alert.alert(
          'Camera permission required',
          'Allow camera access to capture signed delivery notes.',
        );
        return;
      }

      setCameraVisible(true);
    } catch (error) {
      console.error("Failed to request camera permission:");
      Alert.alert('Error', 'Unable to request camera permission.');
    }
  };

  const fetchDeliveryTrips = useCallback(async () => {
    if (!employeeDetails?.name) {
      return;
    }

    try {
      const trips = await getAssignedDeliveryTrips(employeeDetails.name);
      const tripsWithStops = await Promise.all(
        trips.map(async trip => {
          const stops = await getDeliveryStops(trip.name);
          return {...trip, delivery_stops: stops};
        }),
      );
      setDeliveryTrips(tripsWithStops);
    } catch (error) {
      console.error("Failed to fetch delivery trips:");
      Alert.alert('Error', 'Failed to fetch delivery trips');
    }
  }, [employeeDetails?.name]);

  useEffect(() => {
    fetchDeliveryTrips();
  }, [fetchDeliveryTrips]);

  const handleTripPress = trip => {
    setSelectedTrip(trip);
    setModalVisible(true);
  };

  const handleDeliveredTripPress = trip => {
    setSelectedTrip(trip);
    setDeliveredTripsModalVisible(true);
  };

  const captureImage = useCallback(async () => {
    if (!cameraRef.current) {
      console.error("Camera reference is not available");
      Alert.alert('Error', 'Camera is not ready yet.');
      return null;
    }

    setIsLoading(true);
    try {
      const options = {quality: 0.5, base64: true};
      const data = await cameraRef.current.takePictureAsync(options);
      return data;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCaptureImage = async () => {
    try {
      const imageData = await captureImage();
      if (imageData) {
        const fileName = `signed_note_${Date.now()}.jpg`;
        setCapturedImages(prevImages => [
          ...prevImages,
          {...imageData, fileName},
        ]);
        setCameraVisible(false);
      }
    } catch (error) {
      console.error("Failed to capture delivery note image:");
      Alert.alert('Error', 'Unable to capture the delivery note photo.');
    }
  };

  const handleStatusUpdate = async status => {
    try {
      if (status === 'Delivered') {
        if (capturedImages.length === 0) {
          Alert.alert(
            'Error',
            'Please capture at least one signed delivery note photo',
          );
          return;
        }
        if (capturedImages.length > 4) {
          Alert.alert('Error', 'You can capture a maximum of 4 images');
          return;
        }
      }

      setIsUploading(true);

      if (status === 'Delivered') {
        const uploadedImageUrls = await Promise.all(
          capturedImages.map(image =>
            uploadImageToImgur(image.base64, image.fileName),
          ),
        );

        await updateSignedDeliveryNotes(selectedTrip.name, uploadedImageUrls);
        const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');
        await updateCustomDeliveredTime(selectedTrip.name, currentTime);
      }

      await updateDeliveryTripStatus(selectedTrip.name, status);
      Alert.alert('Success', `Trip marked as ${status}`);
      setModalVisible(false);
      setCapturedImages([]);
      fetchDeliveryTrips();
    } catch (error) {
      Alert.alert('Error', `Failed to update trip status: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const openLocationLink = () => {
    if (selectedTrip && selectedTrip.location_link) {
      Linking.openURL(selectedTrip.location_link);
    }
  };

  const renderTripItem = ({item}) => (
    <TouchableOpacity
      style={styles.tripItem}
      onPress={() =>
        item.delivery_status === 'Delivered'
          ? handleDeliveredTripPress(item)
          : handleTripPress(item)
      }>
      <View style={styles.tripHeader}>
        <Text style={styles.tripIcon}>
          {item.delivery_status === 'Delivered' ? '✅' : '🚚'}
        </Text>
        <Text style={styles.tripId}>{item.name}</Text>
      </View>
      <View style={styles.tripInfo}>
        <Text style={styles.tripInfoText}>🕒 {item.departure_time}</Text>
        <Text style={styles.tripInfoText}>👤 {item.driver_name}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderTripDetails = () => (
    <Modal
      isVisible={modalVisible}
      onBackdropPress={() => setModalVisible(false)}
      style={styles.modal}>
      <View style={styles.modalContent}>
        <ScrollView>
          <Text style={styles.modalTitle}>Trip Details</Text>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>ID:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.name}</Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Company:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.company}</Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Email Sent:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.email_notification_sent ? 'Yes' : 'No'}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Driver Information</Text>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Driver:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.driver_name}</Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Email:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.driver_email}</Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Address:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.driver_address}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Number:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.custom_driver_number}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Trip Information</Text>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Status:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.delivery_status}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Total Distance:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.total_distance} {selectedTrip?.uom}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Vehicle:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.vehicle}</Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Departure Time:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.departure_time}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Delivered Time:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.custom_delivered_time || 'Not delivered yet'}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Source Warehouse:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.custom_source_warehouse}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Employee:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.employee}</Text>
          </View>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={openLocationLink}>
            <Text style={styles.linkButtonText}>📍 Open Location Link</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Delivery Stops</Text>
          {selectedTrip?.delivery_stops.map((stop, index) => (
            <View key={index} style={styles.stopItem}>
              <Text style={styles.stopTitle}>Stop {index + 1}</Text>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Customer:</Text>
                <Text style={styles.detailValue}>{stop.customer}</Text>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Delivery Note:</Text>
                <Text style={styles.detailValue}>{stop.delivery_note}</Text>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Address:</Text>
                <Text style={styles.detailValue}>
                  {stop.customer_address.replace(/<br>/g, '\n')}
                </Text>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Contact:</Text>
                <Text style={styles.detailValue}>{stop.customer_contact}</Text>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Email:</Text>
                <Text style={styles.detailValue}>
                  {stop.email_sent ? 'Sent' : 'Not sent'}
                </Text>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Visited:</Text>
                <Text style={styles.detailValue}>
                  {stop.visited ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Capture Signed Delivery Notes</Text>
          <Text style={styles.captureInstructions}>
            Please capture at least 1 and up to 4 images of signed delivery
            notes.
          </Text>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={openCamera}
            disabled={capturedImages.length >= 4}>
            <Text style={styles.buttonText}>
              {capturedImages.length >= 4
                ? 'Max Images Captured'
                : 'Capture Photo'}
            </Text>
          </TouchableOpacity>
          <View style={styles.capturedImagesContainer}>
            {capturedImages.map((image, index) => (
              <View key={index} style={styles.capturedImageWrapper}>
                <Image source={{uri: image.uri}} style={styles.capturedImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() =>
                    setCapturedImages(images =>
                      images.filter((_, i) => i !== index),
                    )
                  }>
                  <Text style={styles.removeImageButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.deliveredButton]}
              onPress={() => handleStatusUpdate('Delivered')}
              disabled={isUploading}>
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>✅ Delivered</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.partialButton]}
              onPress={() => handleStatusUpdate('Partially Delivered')}
              disabled={isUploading}>
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>⚠️ Partially Delivered</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setModalVisible(false)}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>

          {selectedTrip?.amended_from && (
            <Text style={styles.amendedText}>
              Amended From: {selectedTrip.amended_from}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  const renderDeliveredTripDetails = () => (
    <Modal
      isVisible={deliveredTripsModalVisible}
      onBackdropPress={() => setDeliveredTripsModalVisible(false)}
      style={styles.modal}>
      <View style={styles.modalContent}>
        <ScrollView>
          <Text style={styles.modalTitle}>Delivered Trip Details</Text>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>ID:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.name}</Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Company:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.company}</Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Email Sent:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.email_notification_sent ? 'Yes' : 'No'}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Driver Information</Text>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Driver:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.driver_name}</Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Email:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.driver_email}</Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Address:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.driver_address}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Number:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.custom_driver_number}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Trip Information</Text>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Status:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.delivery_status}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Total Distance:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.total_distance} {selectedTrip?.uom}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Vehicle:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.vehicle}</Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Departure Time:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.departure_time}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Delivered Time:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.custom_delivered_time || 'Not delivered yet'}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Source Warehouse:</Text>
            <Text style={styles.detailValue}>
              {selectedTrip?.custom_source_warehouse}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Employee:</Text>
            <Text style={styles.detailValue}>{selectedTrip?.employee}</Text>
          </View>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={openLocationLink}>
            <Text style={styles.linkButtonText}>📍 Open Location Link</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Delivery Stops</Text>
          {selectedTrip?.delivery_stops.map((stop, index) => (
            <View key={index} style={styles.stopItem}>
              <Text style={styles.stopTitle}>Stop {index + 1}</Text>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Customer:</Text>
                <Text style={styles.detailValue}>{stop.customer}</Text>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Delivery Note:</Text>
                <Text style={styles.detailValue}>{stop.delivery_note}</Text>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Address:</Text>
                <Text style={styles.detailValue}>
                  {stop.customer_address.replace(/<br>/g, '\n')}
                </Text>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Contact:</Text>
                <Text style={styles.detailValue}>{stop.customer_contact}</Text>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Email:</Text>
                <Text style={styles.detailValue}>
                  {stop.email_sent ? 'Sent' : 'Not sent'}
                </Text>
              </View>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Visited:</Text>
                <Text style={styles.detailValue}>
                  {stop.visited ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setDeliveredTripsModalVisible(false)}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );

  const renderViewDeliveredTrips = () => (
    <Modal
      isVisible={viewDeliveredModalVisible}
      onBackdropPress={() => setViewDeliveredModalVisible(false)}
      style={styles.modal}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Delivered Trips</Text>
        <FlatList
          data={deliveryTrips.filter(
            trip => trip.delivery_status === 'Delivered',
          )}
          renderItem={renderTripItem}
          keyExtractor={item => item.name}
          contentContainerStyle={styles.listContainer}
        />
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setViewDeliveredModalVisible(false)}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  const renderCamera = () => (
    <Modal
      isVisible={cameraVisible}
      onBackdropPress={() => setCameraVisible(false)}
      style={styles.cameraModal}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        />
        <TouchableOpacity
          style={styles.captureButton}
          onPress={handleCaptureImage}
          disabled={isLoading}>
          <Text style={styles.buttonText}>
            {isLoading ? 'Capturing...' : 'Capture'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assigned Delivery Trips</Text>
      <FlatList
        data={deliveryTrips.filter(
          trip => trip.delivery_status !== 'Delivered',
        )}
        renderItem={renderTripItem}
        keyExtractor={item => item.name}
        contentContainerStyle={styles.listContainer}
      />
      <TouchableOpacity
        style={styles.viewDeliveredButton}
        onPress={() => setViewDeliveredModalVisible(true)}>
        <Text style={styles.viewDeliveredButtonText}>View Delivered Trips</Text>
      </TouchableOpacity>
      {renderTripDetails()}
      {renderCamera()}
      {renderDeliveredTripDetails()}
      {renderViewDeliveredTrips()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  tripItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  tripId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#153156',
  },
  tripInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tripInfoText: {
    fontSize: 14,
    color: '#4A4A4A',
  },
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 22,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#153156',
    marginTop: 20,
    marginBottom: 10,
  },
  detailSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 16,
    color: '#4A4A4A',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    color: '#153156',
  },
  stopItem: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  stopTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 0.48,
  },
  deliveredButton: {
    backgroundColor: '#4CAF50',
  },
  partialButton: {
    backgroundColor: '#FFA500',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    backgroundColor: '#153156',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  linkButton: {
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  amendedText: {
    marginTop: 16,
    fontSize: 14,
    color: '#4A4A4A',
    fontStyle: 'italic',
  },
  viewDeliveredButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  viewDeliveredButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cameraModal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  cameraContainer: {
    backgroundColor: 'black',
    height: '100%',
    width: '100%',
  },
  camera: {
    flex: 1,
  },
  captureButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    margin: 20,
  },
  capturedImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 10,
  },
  capturedImageWrapper: {
    position: 'relative',
    margin: 5,
  },
  capturedImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: 'red',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  captureInstructions: {
    fontSize: 14,
    color: '#4A4A4A',
    marginBottom: 10,
    textAlign: 'center',
  },
});

export default DeliveryTrip;
