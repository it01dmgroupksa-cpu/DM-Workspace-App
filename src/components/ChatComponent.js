import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  StatusBar,
  Image,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import SendBird from 'sendbird';
import RNBlobUtil from 'react-native-blob-util';
import { EmployeeContext } from '../context/EmployeeContext';
import { BackIcon, NewChatIcon, SendIcon, CloseIcon, PlusIcon, DownloadIcon} from './icons';
import { format } from 'date-fns';
import { getEmployeesWithChatAccess } from '../../api';

const sb = new SendBird({ appId: 'F14632B9-78B6-4F39-B7BF-9E5770445DDA' });

const ChatComponent = () => {
  const { employeeDetails } = useContext(EmployeeContext);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employeesWithAccess, setEmployeesWithAccess] = useState([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [chatMode, setChatMode] = useState('direct');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [chatActionLoading, setChatActionLoading] = useState(false);
  const flatListRef = useRef(null);

  const getChannelList = useCallback(() => {
    const channelListQuery = sb.GroupChannel.createMyGroupChannelListQuery();
    channelListQuery.includeEmpty = true;
    channelListQuery.order = 'latest_last_message';
    channelListQuery.limit = 15;

    if (!channelListQuery.hasNext) {
      setChannels([]);
      setLoading(false);
      return;
    }

    channelListQuery.next((channelList, error) => {
      if (error) {
        console.error("Channel list retrieval error:");
        setError('Failed to retrieve chat rooms. Please try again later.');
      } else {
        setChannels(channelList);
      }
      setLoading(false);
    });
  }, []);

  const connectToSendbird = useCallback(async () => {
    if (!employeeDetails?.name) {
      return;
    }

    try {
      await sb.connect(employeeDetails.name);
      getChannelList();
    } catch (error) {
      console.error("Sendbird connection error:");
      setError('Failed to connect to chat service. Please try again later.');
      Alert.alert(
        'Error',
        'Failed to connect to chat service. Please try again later.',
      );
    }
  }, [employeeDetails?.name, getChannelList]);

  const fetchEmployeesWithAccess = useCallback(async () => {
    if (!employeeDetails?.name) {
      return;
    }

    try {
      const employees = await getEmployeesWithChatAccess();
      const eligibleEmployees = employees
        .filter(employee => employee.name && employee.name !== employeeDetails.name)
        .map(employee => ({
          userId: employee.name,
          nickname: employee.employee_name || employee.name,
        }));
      setEmployeesWithAccess(eligibleEmployees);
    } catch (fetchError) {
      console.error('Error fetching employees with chat access.');
      Alert.alert('Error', 'Failed to load colleagues. Please try again later.');
    }
  }, [employeeDetails?.name]);

  useEffect(() => {
    if (employeeDetails?.name) {
      connectToSendbird();
      fetchEmployeesWithAccess();
    }
  }, [employeeDetails?.name, connectToSendbird, fetchEmployeesWithAccess]);

  const handleChannelPress = (channel) => {
    channel.markAsRead();
    setCurrentChannel(channel);
    setMessages([]);
    loadMessages(channel);
  };

  const loadMessages = (channel) => {
    const messageListParams = new sb.MessageListParams();
    messageListParams.prevResultSize = 20;
    messageListParams.includeThreadInfo = true;
    messageListParams.includeReactions = true;

    channel.getMessagesByTimestamp(
      Date.now(),
      messageListParams,
      (messages, error) => {
        if (error) {
          console.error("Message retrieval error:");
          setError('Failed to load messages. Please try again later.');
        } else {
          setMessages(messages);
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }
    );
  };

  const sendMessage = () => {
    if (messageInput.trim() === '') return;

    const params = new sb.UserMessageParams();
    params.message = messageInput;

    currentChannel.sendUserMessage(params, (message, error) => {
      if (error) {
        console.error("Message send error:");
        Alert.alert('Error', 'Failed to send message. Please try again.');
      } else {
        setMessages((prevMessages) => [...prevMessages, message]);
        setMessageInput('');
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    });
  };

  const selectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets?.[0];
      if (!file) {
        throw new Error('The document picker returned no file.');
      }

      sendFile({
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      });
    } catch (error) {
      console.error("File selection error:");
      Alert.alert('Error', 'Failed to select file. Please try again.');
    }
  };

  const sendFile = (file) => {
    const params = new sb.FileMessageParams();
    params.file = {
      uri: file.uri,
      name: file.name,
      type: file.type,
    };

    currentChannel.sendFileMessage(params, (message, error) => {
      if (error) {
        console.error("File send error:");
        Alert.alert('Error', 'Failed to send file. Please try again.');
      } else {
        setMessages((prevMessages) => [...prevMessages, message]);
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    });
  };

  const closeNewChatModal = () => {
    setShowNewChatModal(false);
    setSelectedEmployeeIds([]);
    setGroupName('');
    setChatMode('direct');
  };

  const toggleEmployeeSelection = (userId) => {
    if (chatMode === 'direct') {
      setSelectedEmployeeIds([userId]);
      return;
    }

    setSelectedEmployeeIds(current =>
      current.includes(userId)
        ? current.filter(selectedId => selectedId !== userId)
        : [...current, userId],
    );
  };

  const createNewChat = () => {
    const isGroup = chatMode === 'group';
    if (selectedEmployeeIds.length === 0) return;

    if (isGroup && selectedEmployeeIds.length < 2) {
      Alert.alert('Select colleagues', 'Choose at least two colleagues to create a group.');
      return;
    }

    if (isGroup && !groupName.trim()) {
      Alert.alert('Group name required', 'Enter a name for this group.');
      return;
    }

    if (!isGroup) {
      const existingChannel = channels.find(channel =>
        channel.isDistinct &&
        channel.members.length === 2 &&
        channel.members.some(member => member.userId === selectedEmployeeIds[0]),
      );
      if (existingChannel) {
        setCurrentChannel(existingChannel);
        setMessages([]);
        closeNewChatModal();
        loadMessages(existingChannel);
        return;
      }
    }

    const params = new sb.GroupChannelParams();
    params.addUserIds(selectedEmployeeIds);
    params.isDistinct = !isGroup;
    if (isGroup) {
      params.name = groupName.trim();
    }

    setChatActionLoading(true);
    sb.GroupChannel.createChannel(params, (channel, createError) => {
      setChatActionLoading(false);
      if (createError) {
        console.error('Create chat channel failed.');
        Alert.alert('Error', 'Could not create the chat. Please try again.');
      } else {
        setChannels(current => [channel, ...current.filter(item => item.url !== channel.url)]);
        setCurrentChannel(channel);
        setMessages([]);
        closeNewChatModal();
      }
    });
  };

  const addMembersToGroup = () => {
    if (!currentChannel || selectedEmployeeIds.length === 0) return;

    setChatActionLoading(true);
    currentChannel.inviteWithUserIds(selectedEmployeeIds, (updatedChannel, inviteError) => {
      setChatActionLoading(false);
      if (inviteError) {
        console.error('Adding members to chat failed.');
        Alert.alert('Error', 'Could not add the selected colleagues. Please try again.');
        return;
      }

      setCurrentChannel(updatedChannel);
      setChannels(current =>
        current.map(channel => channel.url === updatedChannel.url ? updatedChannel : channel),
      );
      closeNewChatModal();
      Alert.alert('Members added', 'The selected colleagues have been added to the group.');
    });
  };

  const getChannelName = (channel) => {
    if (!channel.isDistinct && channel.name) {
      return channel.name;
    }
    return channel.members
      .filter(member => member.userId !== employeeDetails.name)
      .map(member => member.nickname || member.userId)
      .join(', ') || 'Chat';
  };

  const renderChannelItem = ({ item }) => {
    return (
      <TouchableOpacity style={styles.channelItem} onPress={() => handleChannelPress(item)}>
        <View style={styles.channelInfo}>
          <Text style={styles.channelName}>{getChannelName(item)}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage ? item.lastMessage.message : 'No messages'}
          </Text>
        </View>
        <View style={styles.channelMeta}>
          {item.unreadMessageCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unreadMessageCount}</Text>
            </View>
          )}
          <Text style={styles.channelTime}>
            {item.lastMessage ? format(new Date(item.lastMessage.createdAt), 'HH:mm') : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const downloadFile = async (fileUrl, fileName) => {
    try {
      if (Platform.OS === 'android' && Number(Platform.Version) <= 28) {
        const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
        const granted = await PermissionsAndroid.check(permission);

        if (!granted) {
          const result = await PermissionsAndroid.request(permission);
          if (result !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              'Permission denied',
              'Storage permission is required to download files on this Android version.',
            );
            return;
          }
        }
      }

      const {config, fs} = RNBlobUtil;
      const downloadDir =
        Platform.OS === 'android' ? fs.dirs.DownloadDir : fs.dirs.DocumentDir;
      const safeFileName =
        fileName.replace(/[<>:"/\\|?*]/g, '_') || 'download';
      const path = `${downloadDir}/${safeFileName}`;

      await config({
        fileCache: true,
        ...(Platform.OS === 'android' && {
          addAndroidDownloads: {
            useDownloadManager: true,
            notification: true,
            path,
            description: 'Downloading file...',
          },
        }),
      })
        .fetch('GET', fileUrl);
      Alert.alert('Success', `File downloaded to ${path}`);
    } catch (error) {
      console.error("Download error:");
      Alert.alert('Error', 'Failed to download file. Please try again.');
    }
  };



  const renderMessageItem = ({ item }) => {
    if (item.messageType === 'file') {
      return (
        <View
          style={[
            styles.messageItem,
            item.sender.userId === employeeDetails.name ? styles.sentMessage : styles.receivedMessage,
          ]}
        >
          <View style={styles.messageContent}>
            {item.type && item.type.startsWith('image/') ? (
              <Image source={{ uri: item.url }} style={styles.imagePreview} />
            ) : (
              <Text style={styles.messageText}>
                {item.name || 'File'}
              </Text>
            )}
            <TouchableOpacity onPress={() => downloadFile(item.url, item.name)}>
              <DownloadIcon width={24} height={24} color="#153156" />
            </TouchableOpacity>
            <Text style={styles.messageTime}>
              {format(new Date(item.createdAt), 'HH:mm')}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageItem,
          item.sender.userId === employeeDetails.name ? styles.sentMessage : styles.receivedMessage,
        ]}
      >
        <View style={styles.messageContent}>
          <Text style={[styles.messageText, item.sender.userId !== employeeDetails.name && styles.receivedMessageText]}>
            {item.message}
          </Text>
          <Text style={styles.messageTime}>
            {format(new Date(item.createdAt), 'HH:mm')}
          </Text>
        </View>
      </View>
    );
  };


  const renderEmployeeItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.employeeItem,
        selectedEmployeeIds.includes(item.userId) && styles.selectedEmployeeItem,
      ]}
      onPress={() => toggleEmployeeSelection(item.userId)}
    >
      <View style={styles.employeeAvatarContainer}>
        <Text style={styles.employeeAvatarText}>{item.nickname[0].toUpperCase()}</Text>
      </View>
      <Text style={styles.employeeName}>{item.nickname}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#153156" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#153156" />
      <View style={styles.container}>
        {!currentChannel ? (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Chats</Text>
              <TouchableOpacity
                style={styles.newChatButton}
                onPress={() => {
                  setChatMode('direct');
                  setSelectedEmployeeIds([]);
                  setShowNewChatModal(true);
                }}
                accessibilityLabel="Start a new chat"
              >
                <NewChatIcon width={24} height={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={channels}
              renderItem={renderChannelItem}
              keyExtractor={(item) => item.url}
              contentContainerStyle={styles.channelList}
            />
          </>
        ) : (
          <>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentChannel(null)}>
                <BackIcon width={24} height={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>
                  {getChannelName(currentChannel)}
                </Text>
              </View>
              {!currentChannel.isDistinct && (
                <TouchableOpacity
                  style={styles.addMembersButton}
                  onPress={() => {
                    setChatMode('addMembers');
                    setSelectedEmployeeIds([]);
                    setShowNewChatModal(true);
                  }}
                  accessibilityLabel="Add members to group"
                >
                  <Text style={styles.addMembersButtonText}>+</Text>
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessageItem}
              keyExtractor={(item) => item.messageId.toString()}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={messageInput}
                onChangeText={setMessageInput}
                placeholder="Type a message"
                placeholderTextColor="#999"
              />
              <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                <SendIcon width={24} height={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachButton} onPress={selectFile}>
              <PlusIcon width={24} height={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </>
        )}

        <Modal
          visible={showNewChatModal}
          animationType="slide"
          transparent={true}
          onRequestClose={closeNewChatModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeNewChatModal} accessibilityLabel="Close">
                  <CloseIcon width={30} height={30} color="#000" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {chatMode === 'addMembers' ? 'Add members' : 'New chat'}
                </Text>
              </View>
              {chatMode !== 'addMembers' && (
                <View style={styles.modeSelector}>
                  <TouchableOpacity
                    style={[styles.modeButton, chatMode === 'direct' && styles.activeModeButton]}
                    onPress={() => {
                      setChatMode('direct');
                      setSelectedEmployeeIds([]);
                    }}
                  >
                    <Text style={[styles.modeButtonText, chatMode === 'direct' && styles.activeModeButtonText]}>
                      Direct
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeButton, chatMode === 'group' && styles.activeModeButton]}
                    onPress={() => {
                      setChatMode('group');
                      setSelectedEmployeeIds([]);
                    }}
                  >
                    <Text style={[styles.modeButtonText, chatMode === 'group' && styles.activeModeButtonText]}>
                      Group
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {chatMode === 'group' && (
                <TextInput
                  style={styles.groupNameInput}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Group name"
                  placeholderTextColor="#999"
                  maxLength={80}
                  accessibilityLabel="Group name"
                />
              )}
              <FlatList
                data={chatMode === 'addMembers'
                  ? employeesWithAccess.filter(employee =>
                    !currentChannel?.members.some(member => member.userId === employee.userId),
                  )
                  : employeesWithAccess}
                renderItem={renderEmployeeItem}
                keyExtractor={(item) => item.userId}
                contentContainerStyle={styles.employeeList}
                ListEmptyComponent={
                  <Text style={styles.emptyEmployeeText}>No colleagues available to add.</Text>
                }
              />
              <TouchableOpacity
                style={[
                  styles.startChatButton,
                  (selectedEmployeeIds.length === 0 || chatActionLoading) && styles.disabledButton,
                ]}
                onPress={chatMode === 'addMembers' ? addMembersToGroup : createNewChat}
                disabled={selectedEmployeeIds.length === 0 || chatActionLoading}
              >
                {chatActionLoading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : (
                    <Text style={styles.startChatButtonText}>
                      {chatMode === 'addMembers'
                        ? 'Add selected'
                        : chatMode === 'group'
                          ? 'Create group'
                          : 'Start chat'}
                    </Text>
                  )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#153156',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F7FA',
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#153156',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  newChatButton: {
    padding: 10,
  },
  addMembersButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  addMembersButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '500',
  },
  channelList: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#153156',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 5,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  channelMeta: {
    alignItems: 'flex-end',
  },
  unreadBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 5,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  channelTime: {
    fontSize: 12,
    color: '#666',
  },
  messageList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  messageItem: {
    maxWidth: '80%',
    marginBottom: 5, // Reduced from 10
  },
  messageContent: {
    borderRadius: 15, // Reduced from 20
    padding: 8, // Reduced from 15
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#153156',
    borderRadius: 15, // Reduced from 20
    padding: 8, // Reduced from 10
    marginBottom: 3, // Reduced from 5
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#153156',
    borderWidth: 1,
    borderRadius: 15, // Reduced from 20
    padding: 8, // Reduced from 10
    marginBottom: 3, // Reduced from 5
  },
  messageText: {
    fontSize: 16,
    color: '#FFF',
  },
  receivedMessageText: {
    color: '#153156',
  },
  messageTime: {
    fontSize: 10, // Reduced from 12
    color: '#666',
    alignSelf: 'flex-end',
    marginTop: 3, // Reduced from 5
  },
  imagePreview: {
    width: 150,
    height: 150,
    borderRadius: 10,
    marginBottom: 5,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  backButton: {
    padding: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#153156',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButton: {
    backgroundColor: '#153156',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
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
    paddingHorizontal: 20,
    paddingVertical: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    textAlign: 'center',
    flex: 1,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F0F2F5',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeModeButton: {
    backgroundColor: '#153156',
  },
  modeButtonText: {
    color: '#153156',
    fontSize: 15,
    fontWeight: '600',
  },
  activeModeButtonText: {
    color: '#FFFFFF',
  },
  groupNameInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6DCE5',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
    color: '#153156',
  },
  employeeList: {
    paddingBottom: 20,
  },
  emptyEmployeeText: {
    color: '#666',
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 24,
  },
  employeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectedEmployeeItem: {
    backgroundColor: '#E8F0FE',
  },
  employeeAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#153156',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  employeeAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  employeeName: {
    fontSize: 16,
    color: '#333',
  },
  startChatButton: {
    backgroundColor: '#153156',
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  startChatButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});

export default ChatComponent;