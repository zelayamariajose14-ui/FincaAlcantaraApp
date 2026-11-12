import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  ScrollView,
  Image,
  ImageBackground,
  Modal,
} from 'react-native';
import { supabase } from './supabase';

export default function App() {
  const [tab, setTab] = useState('dashboard'); // dashboard | asistencia | pesaje | planilla | registrar
  const [trabajadores, setTrabajadores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState(null);
  
  // Estado para el modal de perfil detallado del trabajador
  const [modalVisible, setModalVisible] = useState(false);
  const [detalleTrabajador, setDetalleTrabajador] = useState(null);
  const [historialTrabajador, setHistorialTrabajador] = useState([]);

  // Días de la semana y estado para el día seleccionado
  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => {
    const diaNum = new Date().getDay();
    return diaNum === 0 ? 'Lunes' : diasSemana[diaNum - 1] || 'Lunes';
  });

  // Estados de Pesaje
  const [pesoInput, setPesoInput] = useState('');
  const [cortesHoy, setCortesHoy] = useState([]);
  const [tarifa] = useState(3.5); // Tarifa por libra

  // Estados de Planilla Semanal
  const [planillaSemanal, setPlanillaSemanal] = useState([]);

  // Estados para nuevo trabajador
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaIdentidad, setNuevaIdentidad] = useState('');

  const fechaHoy = new Date().toISOString().split('T')[0];

  useEffect(() => {
    cargarTrabajadores();
  }, []);

  useEffect(() => {
    if (trabajadorSeleccionado?.id) {
      cargarCortesHoy(trabajadorSeleccionado.id);
    } else {
      setCortesHoy([]);
    }
  }, [trabajadorSeleccionado]);

  useEffect(() => {
    if (tab === 'planilla') {
      calcularPlanillaSemanal();
    }
  }, [tab]);

  // Cargar trabajadores
  const cargarTrabajadores = async () => {
    const { data, error } = await supabase.from('trabajadores').select('*');
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setTrabajadores(data || []);
      if (data && data.length > 0 && !trabajadorSeleccionado) {
        setTrabajadorSeleccionado(data[0]);
      }
    }
  };

  // Abrir perfil detallado del trabajador
  const abrirPerfilTrabajador = async (trabajador) => {
    setDetalleTrabajador(trabajador);
    setModalVisible(true);
    cargarHistorialTrabajador(trabajador.id);
  };

  const cargarHistorialTrabajador = async (id) => {
    const { data } = await supabase
      .from('cortes_diarios')
      .select('*')
      .eq('trabajador_id', id)
      .order('fecha', { ascending: false });
    setHistorialTrabajador(data || []);
  };

  // ELIMINAR UN REGISTRO DE CORTE/ASISTENCIA
  const eliminarCorte = (corteId) => {
    Alert.alert(
      'Eliminar Registro',
      '¿Estás segura de que deseas borrar este registro de la base de datos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('cortes_diarios').delete().eq('id', corteId);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              Alert.alert('Éxito', 'Registro eliminado correctamente.');
              if (detalleTrabajador) cargarHistorialTrabajador(detalleTrabajador.id);
              if (trabajadorSeleccionado) cargarCortesHoy(trabajadorSeleccionado.id);
            }
          }
        }
      ]
    );
  };

  // ELIMINAR UN TRABAJADOR COMPLETO
  const eliminarTrabajador = (trabajadorId, nombreTrabajador) => {
    Alert.alert(
      'Eliminar Trabajador',
      `¿Deseas eliminar a ${nombreTrabajador} y todo su historial?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            // Primero borramos sus cortes asociados para evitar errores de relación en Supabase
            await supabase.from('cortes_diarios').delete().eq('trabajador_id', trabajadorId);
            // Luego borramos al trabajador
            const { error } = await supabase.from('trabajadores').delete().eq('id', trabajadorId);
            
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              Alert.alert('Éxito', 'Trabajador eliminado correctamente.');
              setModalVisible(false);
              cargarTrabajadores();
            }
          }
        }
      ]
    );
  };

  // Registrar nuevo trabajador
  const registrarTrabajador = async () => {
    if (!nuevoNombre.trim() || !nuevaIdentidad.trim()) {
      Alert.alert('Atención', 'Llena todos los campos.');
      return;
    }
    const { error } = await supabase.from('trabajadores').insert([
      { Nombre: nuevoNombre.trim(), 'Numero de Identidad': nuevaIdentidad.trim() }
    ]);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Éxito', 'Trabajador registrado.');
      setNuevoNombre('');
      setNuevaIdentidad('');
      cargarTrabajadores();
      setTab('asistencia');
    }
  };

  // Marcar Asistencia
  const registrarAsistencia = async (trabajadorId, estado) => {
    const { error } = await supabase.from('cortes_diarios').insert([
      { trabajador_id: trabajadorId, fecha: fechaHoy, Asistencia: estado, Libras: 0, pago_estimado: 0 }
    ]);
    if (error) {
      Alert.alert('Aviso', `Ya cuenta con un registro para hoy (${diaSeleccionado}).`);
    } else {
      Alert.alert('Éxito', `Marcado como ${estado}`);
    }
  };

  // Guardar Pesaje
  const guardarPesaje = async () => {
    if (!trabajadorSeleccionado) return Alert.alert('Atención', 'Selecciona un trabajador.');
    const librasVal = parseFloat(pesoInput);
    if (!librasVal || librasVal <= 0) return Alert.alert('Atención', 'Ingresa libras válidas.');

    const pagoEstimado = librasVal * tarifa;
    const { error } = await supabase.from('cortes_diarios').insert([
      {
        trabajador_id: trabajadorSeleccionado.id,
        fecha: fechaHoy,
        Libras: librasVal,
        Asistencia: 'Presente',
        pago_estimado: pagoEstimado
      }
    ]);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setPesoInput('');
      cargarCortesHoy(trabajadorSeleccionado.id);
      Alert.alert('Éxito', 'Pesaje registrado.');
    }
  };

  const cargarCortesHoy = async (id) => {
    const { data } = await supabase
      .from('cortes_diarios')
      .select('*')
      .eq('trabajador_id', id)
      .eq('fecha', fechaHoy);
    setCortesHoy(data || []);
  };

  // Calcular Planilla Semanal
  const calcularPlanillaSemanal = async () => {
    const { data, error } = await supabase.from('cortes_diarios').select('*, trabajadores(Nombre)');
    if (!error && data) {
      const resumen = {};
      data.forEach(item => {
        const tId = item.trabajador_id;
        const nombre = item.trabajadores?.Nombre || 'Desconocido';
        if (!resumen[tId]) {
          resumen[tId] = { nombre, totalLibras: 0, totalPago: 0, diasAsistidos: new Set() };
        }
        resumen[tId].totalLibras += Number(item.Libras || 0);
        resumen[tId].totalPago += Number(item.pago_estimado || 0);
        if (item.Asistencia === 'Presente') {
          resumen[tId].diasAsistidos.add(item.fecha);
        }
      });

      const listaFinal = Object.keys(resumen).map(id => ({
        id,
        nombre: resumen[id].nombre,
        libras: resumen[id].totalLibras,
        pago: resumen[id].totalPago,
        dias: resumen[id].diasAsistidos.size
      }));
      setPlanillaSemanal(listaFinal);
    }
  };

  const trabajadoresFiltrados = trabajadores.filter(t => 
    t.Nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    t['Numero de Identidad'].includes(busqueda)
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* ENCABEZADO CON TEXTURA DE CAFÉ */}
      <ImageBackground 
        source={require('./assets/textura_cafe.png')} 
        style={styles.headerBackground}
        imageStyle={styles.headerImageStyle}
      >
        <View style={styles.headerContent}>
          <Image source={require('./assets/logo.png')} style={styles.logoImage} />
          <View>
            <Text style={styles.headerTitle}>Finca Alcántara</Text>
            <Text style={styles.headerSubtitle}>Fecha: {fechaHoy} ({diaSeleccionado})</Text>
          </View>
        </View>
      </ImageBackground>

      {/* MENÚ DE NAVEGACIÓN */}
      <View style={styles.nav}>
        <TouchableOpacity style={[styles.navBtn, tab === 'dashboard' && styles.navBtnActive]} onPress={() => setTab('dashboard')}>
          <Text style={[styles.navText, tab === 'dashboard' && styles.navTextActive]}>Inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, tab === 'asistencia' && styles.navBtnActive]} onPress={() => setTab('asistencia')}>
          <Text style={[styles.navText, tab === 'asistencia' && styles.navTextActive]}>Asistencia</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, tab === 'pesaje' && styles.navBtnActive]} onPress={() => setTab('pesaje')}>
          <Text style={[styles.navText, tab === 'pesaje' && styles.navTextActive]}>Pesaje</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, tab === 'planilla' && styles.navBtnActive]} onPress={() => setTab('planilla')}>
          <Text style={[styles.navText, tab === 'planilla' && styles.navTextActive]}>Planilla</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, tab === 'registrar' && styles.navBtnActive]} onPress={() => setTab('registrar')}>
          <Text style={[styles.navText, tab === 'registrar' && styles.navTextActive]}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* VISTA 1: DASHBOARD */}
      {tab === 'dashboard' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Resumen General de la Finca</Text>
          <View style={styles.cardDashboard}>
            <Text style={styles.dashLabel}>Trabajadores Registrados</Text>
            <Text style={styles.dashValue}>{trabajadores.length}</Text>
          </View>
          <View style={styles.cardDashboard}>
            <Text style={styles.dashLabel}>Tarifa Actual por Libra</Text>
            <Text style={styles.dashValue}>L. {tarifa.toFixed(2)}</Text>
          </View>
        </ScrollView>
      )}

      {/* VISTA 2: ASISTENCIA */}
      {tab === 'asistencia' && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Pase de Lista Diario (Toca un trabajador para ver su perfil)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.diasContainer}>
            {diasSemana.map((d) => (
              <TouchableOpacity 
                key={d} 
                style={[styles.diaChip, diaSeleccionado === d && styles.diaChipActive]}
                onPress={() => setDiaSeleccionado(d)}
              >
                <Text style={[styles.diaChipText, diaSeleccionado === d && styles.diaChipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.buscador}
            placeholder="Buscar por nombre o identidad..."
            placeholderTextColor="#8c7355"
            value={busqueda}
            onChangeText={setBusqueda}
          />

          <FlatList
            data={trabajadoresFiltrados}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => abrirPerfilTrabajador(item)}>
                <View>
                  <Text style={styles.workerName}>{item.Nombre}</Text>
                  <Text style={styles.workerId}>ID: {item['Numero de Identidad']}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }} onStartShouldSetResponder={() => true}>
                  <TouchableOpacity style={styles.btnPresente} onPress={() => registrarAsistencia(item.id, 'Presente')}>
                    <Text style={styles.btnTextPresente}>Presente</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnAusente} onPress={() => registrarAsistencia(item.id, 'Ausente')}>
                    <Text style={styles.btnTextAusente}>Ausente</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* VISTA 3: PESAJE */}
      {tab === 'pesaje' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Registro de Pesos</Text>
          <Text style={styles.label}>Seleccionar Trabajador:</Text>
          <View style={styles.pickerContainer}>
            {trabajadores.map((w) => (
              <TouchableOpacity
                key={w.id}
                style={[styles.workerChip, trabajadorSeleccionado?.id === w.id && styles.workerChipActive]}
                onPress={() => setTrabajadorSeleccionado(w)}
              >
                <Text style={[styles.chipText, trabajadorSeleccionado?.id === w.id && styles.chipTextActive]}>{w.Nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Libras Cortadas:</Text>
          <TextInput 
            style={styles.input} 
            placeholder="0.00" 
            placeholderTextColor="#a3907c"
            value={pesoInput} 
            onChangeText={setPesoInput} 
            keyboardType="numeric" 
          />

          <TouchableOpacity style={styles.btnSave} onPress={guardarPesaje}>
            <Text style={styles.btnSaveText}>Anotar Pesaje</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Entregas Registradas Hoy (Toca para eliminar si hubo error):</Text>
          {cortesHoy.map((p) => (
            <TouchableOpacity key={p.id} style={styles.historyRow} onPress={() => eliminarCorte(p.id)}>
              <View>
                <Text style={styles.historyText}>Corte registrado</Text>
                <Text style={{ fontSize: 10, color: '#c92a2a' }}>Toca para eliminar</Text>
              </View>
              <Text style={styles.historyWeight}>{p.Libras} Lbs (L. {p.pago_estimado})</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* VISTA 4: PLANILLA SEMANAL */}
      {tab === 'planilla' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Planilla Semanal Acumulada</Text>
          {planillaSemanal.map((p) => (
            <View key={p.id} style={styles.cardPlanilla}>
              <View>
                <Text style={styles.workerName}>{p.nombre}</Text>
                <Text style={styles.workerId}>Días asistidos: {p.dias} | Total: {p.libras} Lbs</Text>
              </View>
              <Text style={styles.planillaMonto}>L. {p.pago.toFixed(2)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* VISTA 5: REGISTRAR TRABAJADOR */}
      {tab === 'registrar' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Registrar Nuevo Trabajador</Text>
          <Text style={styles.label}>Nombre Completo:</Text>
          <TextInput style={styles.inputField} placeholder="Ej. Juan Pérez" placeholderTextColor="#a3907c" value={nuevoNombre} onChangeText={setNuevoNombre} />
          <Text style={styles.label}>Número de Identidad:</Text>
          <TextInput style={styles.inputField} placeholder="Ej. 0301-1990-00123" placeholderTextColor="#a3907c" value={nuevaIdentidad} onChangeText={setNuevaIdentidad} />
          <TouchableOpacity style={styles.btnSave} onPress={registrarTrabajador}>
            <Text style={styles.btnSaveText}>Guardar</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* MODAL DE PERFIL DETALLADO Y ELIMINACIÓN */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.modalTitle}>{detalleTrabajador?.Nombre}</Text>
                <Text style={styles.modalSubtitle}>ID: {detalleTrabajador?.['Numero de Identidad']}</Text>
              </View>
              <TouchableOpacity 
                style={styles.btnDeleteWorker} 
                onPress={() => eliminarTrabajador(detalleTrabajador.id, detalleTrabajador.Nombre)}
              >
                <Text style={styles.btnDeleteWorkerText}>Eliminar Trabajador</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.sectionTitle, { marginTop: 15 }]}>Historial (Toca un registro para borrarlo):</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {historialTrabajador.length === 0 ? (
                <Text style={{ color: '#8c7355', textAlign: 'center', marginTop: 10 }}>No hay registros recientes.</Text>
              ) : (
                historialTrabajador.map((h, index) => (
                  <TouchableOpacity key={index} style={styles.modalHistoryRow} onPress={() => eliminarCorte(h.id)}>
                    <View>
                      <Text style={{ fontWeight: 'bold', color: '#5c3a21', fontSize: 13 }}>Fecha: {h.fecha}</Text>
                      <Text style={{ fontSize: 11, color: '#c92a2a' }}>Estado/Lbs: {h.Asistencia || 'Presente'} ({h.Libras || 0} Lbs)</Text>
                    </View>
                    <Text style={{ fontWeight: 'bold', color: '#c92a2a', fontSize: 12 }}>Borrar 🗑️</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity style={styles.btnCloseModal} onPress={() => setModalVisible(false)}>
              <Text style={styles.btnCloseModalText}>Cerrar Perfil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfbfa' },
  
  headerBackground: { height: 95, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: '#c92a2a', backgroundColor: '#5c3a21' },
  headerImageStyle: { opacity: 0.75, resizeMode: 'cover' },
  headerContent: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },

  logoImage: { width: 45, height: 45, borderRadius: 22.5, marginRight: 12, borderWidth: 1.5, borderColor: '#ffffff' },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: -1, height: 1}, textShadowRadius: 10 },
  headerSubtitle: { color: '#ffffff', fontSize: 11, fontWeight: 'bold', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: -1, height: 1}, textShadowRadius: 10 },
  
  nav: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e4dcd3' },
  navBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  navBtnActive: { borderBottomWidth: 3, borderBottomColor: '#2b8a3e' },
  navText: { fontWeight: 'bold', color: '#5c3a21', fontSize: 10 },
  navTextActive: { color: '#2b8a3e' },
  
  content: { padding: 16, flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#5c3a21', marginBottom: 12 },
  
  diasContainer: { flexDirection: 'row', marginBottom: 12, maxHeight: 36 },
  diaChip: { backgroundColor: '#f0eae1', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6, borderWidth: 1, borderColor: '#d4c7b8' },
  diaChipActive: { backgroundColor: '#2b8a3e', borderColor: '#2b8a3e' },
  diaChipText: { fontSize: 12, color: '#5c3a21', fontWeight: 'bold' },
  diaChipTextActive: { color: '#ffffff' },

  buscador: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d4c7b8', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 14, color: '#2c1e14' },
  
  card: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#ede6dc', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardDashboard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e4dcd3', borderLeftWidth: 5, borderLeftColor: '#2b8a3e', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardPlanilla: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#ede6dc', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  
  dashLabel: { fontSize: 12, color: '#7a6552', fontWeight: 'bold' },
  dashValue: { fontSize: 20, fontWeight: 'bold', color: '#5c3a21', marginTop: 4 },
  
  workerName: { fontWeight: 'bold', fontSize: 14, color: '#2c1e14' },
  workerId: { fontSize: 12, color: '#8c7355' },
  
  btnPresente: { backgroundColor: '#e6f4ea', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#2b8a3e' },
  btnTextPresente: { color: '#2b8a3e', fontWeight: 'bold', fontSize: 11 },
  
  btnAusente: { backgroundColor: '#fce8e6', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#c92a2a' },
  btnTextAusente: { color: '#c92a2a', fontWeight: 'bold', fontSize: 11 },
  
  label: { fontSize: 12, fontWeight: 'bold', color: '#5c3a21', marginTop: 8 },
  
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 },
  workerChip: { backgroundColor: '#f0eae1', padding: 8, borderRadius: 16, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#d4c7b8' },
  workerChipActive: { backgroundColor: '#5c3a21', borderColor: '#5c3a21' },
  chipText: { fontSize: 12, color: '#5c3a21' },
  chipTextActive: { color: '#ffffff', fontWeight: 'bold' },
  
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d4c7b8', borderRadius: 8, padding: 12, fontSize: 18, fontWeight: 'bold', marginVertical: 8, color: '#2c1e14' },
  inputField: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d4c7b8', borderRadius: 8, padding: 12, fontSize: 14, marginVertical: 8, color: '#2c1e14' },
  
  btnSave: { backgroundColor: '#2b8a3e', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  btnSaveText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  
  historyRow: { backgroundColor: '#fff5f5', padding: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, borderWidth: 1, borderColor: '#f5c6cb' },
  historyText: { color: '#7a6552', fontSize: 13 },
  historyWeight: { fontWeight: 'bold', color: '#c92a2a', fontSize: 14 },
  
  planillaMonto: { fontWeight: 'extrabold', color: '#c92a2a', fontSize: 14 },

  // Estilos del Modal y botones de eliminación
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#5c3a21' },
  modalSubtitle: { fontSize: 13, color: '#8c7355', marginBottom: 10 },
  
  btnDeleteWorker: { backgroundColor: '#fce8e6', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#c92a2a' },
  btnDeleteWorkerText: { color: '#c92a2a', fontSize: 11, fontWeight: 'bold' },

  modalHistoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0eae1' },
  btnCloseModal: { backgroundColor: '#5c3a21', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  btnCloseModalText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 }
});
  
  