import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
} from 'react-native';
import { fetchUsers, registerUser } from '../../utils/api';

export default function ClientOverview({ navigation }) {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [selectedRole, setSelectedRole] = useState('client');

  useEffect(() => {
    if (users.length === 0) {
      console.log("📢 useEffect triggered: Calling loadUsers()");
      loadUsers(1, searchQuery);
    }
  }, []);
  
  const loadUsers = async (pageNumber = 1, searchText = '') => {
    console.log(`🔍 Checking conditions: loading=${loading}, hasMore=${hasMore}, page=${pageNumber}`);
  
    if (!hasMore) {
      console.warn("⏳ Skipping fetch: No more users to load.");
      return;
    }
  
    if (loading && pageNumber > 1) {  // ✅ Allow first page to load
      console.warn("⏳ Skipping fetch: Already loading.");
      return;
    }
  
    setLoading(true);
    try {
      console.log(`📡 Fetching users from API: Page ${pageNumber}, Search '${searchText}'`);
      const userList = await fetchUsers(pageNumber, searchText);
  
      console.log(`📢 API Response: Received ${userList.length} users on Page ${pageNumber}`, userList);
  
      if (!userList || userList.length === 0) {
        console.warn("⚠ No more users returned from API. Stopping further requests.");
        setHasMore(false);
      } else {
        console.log(`✅ Users added to list: ${userList.length}`);
        setUsers((prevUsers) => {
          const updatedUsers = [...prevUsers, ...userList];
          console.log("🔄 Updated Users List:", updatedUsers);
          return updatedUsers;
        });
        setPage(pageNumber + 1);
        setHasMore(userList.length === 20);
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };
  


  const handleSearch = (text) => {
    console.log(`🔍 Search input changed: '${text}'`);
    setSearchQuery(text);
  
    if (text.trim().length === 0) {
      setPage(1);
      setHasMore(true);
      loadUsers(1, '');
    } else {
      const filteredUsers = users.filter((user) =>
        user.username.toLowerCase().includes(text.toLowerCase()) || 
        user.role.toLowerCase().includes(text.toLowerCase())
      );
      console.log("🔎 Filtered users based on search:", filteredUsers);
      setUsers(filteredUsers);
    }
  };
  


  const handleAddClient = async () => {
    if (!newClientName) return alert('Please enter a name.');

    try {
      const newUser = await registerUser({ username: newClientName, role: selectedRole });
      setNewClientName('');
      setSelectedRole('client');
      setModalVisible(false);
      setPage(1);
      setUsers([]);
      loadUsers(1, searchQuery);
    } catch (error) {
      console.error('Error registering client:', error);
      alert('Failed to register client. Try again.');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      <Text style={styles.header}>Client & Trainer Overview</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search users..."
        placeholderTextColor="#555"
        value={searchQuery}
        onChangeText={handleSearch}
      />

      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.addButtonText}>+ Add Client</Text>
      </TouchableOpacity>

      {loading && users.length === 0 ? (
        <ActivityIndicator size="large" color="#f6b000" />
      ) : (
<FlatList
  data={users}
  keyExtractor={(item) => item.user_id?.toString() || Math.random().toString()}  
  numColumns={3}  
  columnWrapperStyle={styles.row} 
  renderItem={({ item }) => {
    console.log("📢 Rendering user:", item);
    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => navigation.navigate('ProfileScreen', { userId: item.user_id })}
      >
        <Text style={styles.username}>{item.username} - {item.role}</Text>
      </TouchableOpacity>
    );
  }}
  ListEmptyComponent={() => <Text style={styles.emptyMessage}>No users found.</Text>}
  onEndReached={() => {
    if (!loading && hasMore) {
      loadUsers(page, searchQuery);
    }
  }}
  onEndReachedThreshold={0.5}
/>





      )}

      {/* Add Client Modal */}
      <Modal transparent animationType="slide" visible={isModalVisible}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Add New Client</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter client's name"
              value={newClientName}
              onChangeText={setNewClientName}
            />
            <Text style={styles.roleLabel}>Select Role:</Text>
            <TouchableOpacity
              style={[styles.roleButton, selectedRole === 'client' && styles.roleSelected]}
              onPress={() => setSelectedRole('client')}
            >
              <Text style={styles.roleText}>Client</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleButton, selectedRole === 'trainer' && styles.roleSelected]}
              onPress={() => setSelectedRole('trainer')}
            >
              <Text style={styles.roleText}>Trainer</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleAddClient}>
                <Text style={styles.saveText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#FFFFFF' },
  logo: { width: 150, height: 80 },
  backButton: { position: 'absolute', top: 20, right: 20, backgroundColor: '#f6b000', padding: 10, borderRadius: 8 },
  backButtonText: { color: '#1A1A1A', fontWeight: 'bold', fontSize: 18 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#3274ba', marginBottom: 16 },
  searchInput: { borderWidth: 1, borderColor: '#8ebce6', borderRadius: 8, padding: 12, width: '90%', marginBottom: 16 },
  addButton: { backgroundColor: '#32a852', padding: 12, borderRadius: 8, marginBottom: 16 },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  row: { flex: 1, justifyContent: 'space-between', marginBottom: 12 },
  userCard: { flex: 1, alignItems: 'center', backgroundColor: '#f6b000', padding: 12, marginHorizontal: 4, borderRadius: 8 },
  username: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },

  /** ✅ Restored Beautiful Modal Styles **/
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '85%', alignItems: 'center' },
  modalHeader: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, color: '#3274ba' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, width: '90%', marginBottom: 12, backgroundColor: '#f8f8f8' },
  roleButton: { padding: 10, marginVertical: 5, borderRadius: 8, width: '50%', alignItems: 'center', borderWidth: 1, borderColor: '#3274ba' },
  roleSelected: { backgroundColor: '#3274ba' },
  modalButtons: { flexDirection: 'row', marginTop: 15 },
  cancelButton: { backgroundColor: '#d9534f', padding: 12, borderRadius: 8, marginRight: 10 },
  saveButton: { backgroundColor: '#32a852', padding: 12, borderRadius: 8 },
  cancelText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
