import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import es from 'date-fns/locale/es';
import axios from 'axios';
import logoTec from './assets/logo-tec.png'; 

const locales = { 'es': es }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

// --- COMPONENTE LOGIN (Sin cambios) ---
const LoginScreen = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!isLogin && !formData.email.endsWith('@tecmilenio.mx')) { setError('⚠️ Usa correo @tecmilenio.mx'); return; }
    const endpoint = isLogin ? '/api/login' : '/api/register';
    try {
      const res = await axios.post(`http://localhost:3000${endpoint}`, formData);
      if (isLogin) onLoginSuccess(res.data);
      else { setSuccess('¡Cuenta activada!'); setIsLogin(true); setFormData({ ...formData, password: '' }); }
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
  };
  return (
    <div className="h-screen bg-tec-gris-claro flex flex-col justify-center items-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-8 border-tec-azul animate-fade-in-up">
        <div className="flex justify-center mb-6"><img src={logoTec} alt="Logo" className="h-16" /></div>
        <h2 className="text-2xl font-bold text-center text-tec-azul mb-2">{isLogin ? 'Iniciar Sesión' : 'Activar Cuenta'}</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm font-bold border border-red-200 text-center">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm font-bold border border-green-200 text-center">{success}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && <div><label className="text-xs font-bold text-gray-500 uppercase">Nombre</label><input type="text" className="w-full border p-3 rounded-lg" required value={formData.nombre} onChange={e=>setFormData({...formData, nombre: e.target.value})}/></div>}
          <div><label className="text-xs font-bold text-gray-500 uppercase">Correo</label><input type="email" className="w-full border p-3 rounded-lg" required value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})}/></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase">Contraseña</label><input type="password" className="w-full border p-3 rounded-lg" required value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})}/></div>
          <button type="submit" className="bg-tec-azul text-white font-bold py-3 rounded-lg hover:bg-[#001f3f] mt-2 shadow-lg">{isLogin ? 'Entrar' : 'Registrar'}</button>
        </form>
        <div className="mt-6 text-center border-t pt-4"><button onClick={()=>{setIsLogin(!isLogin);setError('');}} className="text-tec-verde font-bold hover:underline">{isLogin ? 'Activar cuenta' : 'Volver al login'}</button></div>
      </div>
    </div>
  );
};

// --- BARRA CALENDARIO (Sin cambios) ---
const CustomToolbar = ({ onNavigate, onView, label, view }) => {
  const isActive = (v) => view === v ? 'bg-tec-verde text-white' : 'text-gray-500 hover:bg-gray-100';
  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 p-2 border-b border-gray-100 pb-4">
      <div className="flex gap-2">
        <button type="button" className="px-3 py-1 text-sm font-bold text-gray-600 border rounded hover:bg-gray-50" onClick={() => onNavigate('TODAY')}>Hoy</button>
        <div className="flex"><button type="button" className="px-3 py-1 text-gray-600 border-l border-t border-b rounded-l hover:bg-gray-50" onClick={() => onNavigate('PREV')}>←</button><button type="button" className="px-3 py-1 text-gray-600 border rounded-r hover:bg-gray-50" onClick={() => onNavigate('NEXT')}>→</button></div>
      </div>
      <span className="text-xl font-bold text-tec-azul uppercase tracking-wide">{label}</span>
      <div className="flex bg-gray-100 p-1 rounded-lg">
        {['month', 'week', 'day', 'agenda'].map(v => <button key={v} type="button" onClick={() => onView(v)} className={`px-4 py-1 text-sm font-medium rounded-md transition uppercase ${isActive(v)}`}>{v === 'month' ? 'Mes' : v === 'week' ? 'Sem' : v === 'day' ? 'Día' : 'Agenda'}</button>)}
      </div>
    </div>
  );
};

// --- APP PRINCIPAL ---
function App() {
  const [usuario, setUsuario] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null); 
  
  // Estado para controlar si estamos editando
  const [modoEdicion, setModoEdicion] = useState(false); 
  const [idEventoEdicion, setIdEventoEdicion] = useState(null);

  const [date, setDate] = useState(new Date());
  const [view, setView] = useState(Views.MONTH);
  const onNavigate = useCallback((d) => setDate(d), []);
  const onView = useCallback((v) => setView(v), []);

  const [nuevaReserva, setNuevaReserva] = useState({
    titulo: '', sala_id: '1', fecha: '', horaInicio: '10:00', horaFin: '12:00', requerimientos: ''
  });

  const cargarReservas = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/reservas');
      setEventos(res.data.map(r => ({
        id: r.id, // IMPORTANTE: Guardamos el ID para poder editar/borrar
        title: `${r.titulo_evento} (${r.nombre_sala})`,
        start: new Date(r.fecha_inicio), end: new Date(r.fecha_fin),
        resource: r.nombre_sala, responsable: r.responsable, requerimientos: r.requerimientos_fisicos, salaReal: r.nombre_sala,
        tituloOriginal: r.titulo_evento, salaIdOriginal: r.sala_id // Datos puros para rellenar form
      })));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if(usuario) cargarReservas(); }, [usuario]);

  // --- GUARDAR (CREAR O EDITAR) ---
  const guardarReserva = async (e) => {
    e.preventDefault();
    const startString = `${nuevaReserva.fecha} ${nuevaReserva.horaInicio}:00`;
    const endString = `${nuevaReserva.fecha} ${nuevaReserva.horaFin}:00`;
    const payload = {
      sala_id: nuevaReserva.sala_id, titulo: nuevaReserva.titulo, responsable: usuario.nombre_completo,
      inicio: startString, fin: endString, requerimientos: nuevaReserva.requerimientos
    };

    try {
      if (modoEdicion) {
        // ACTUALIZAR (PUT)
        await axios.put(`http://localhost:3000/api/reservas/${idEventoEdicion}`, payload);
        alert('¡Evento actualizado!');
      } else {
        // CREAR (POST)
        await axios.post('http://localhost:3000/api/reservas', payload);
        alert('¡Reserva creada!');
      }
      setMostrarModal(false); cargarReservas(); limpiarForm();
    } catch (error) { alert(error.response?.data?.error || 'Error'); }
  };

  // --- ELIMINAR ---
  const eliminarReserva = async () => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer.")) return;
    try {
      await axios.delete(`http://localhost:3000/api/reservas/${eventoSeleccionado.id}`);
      alert("Evento eliminado");
      setEventoSeleccionado(null);
      cargarReservas();
    } catch (error) { alert("Error al eliminar"); }
  };

  // --- PREPARAR EDICIÓN ---
  const iniciarEdicion = () => {
    const ev = eventoSeleccionado;
    setNuevaReserva({
      titulo: ev.tituloOriginal,
      sala_id: ev.salaIdOriginal,
      fecha: format(ev.start, 'yyyy-MM-dd'),
      horaInicio: format(ev.start, 'HH:mm'),
      horaFin: format(ev.end, 'HH:mm'),
      requerimientos: ev.requerimientos
    });
    setModoEdicion(true);
    setIdEventoEdicion(ev.id);
    setEventoSeleccionado(null); // Cierra modal detalles
    setMostrarModal(true); // Abre modal formulario
  };

  const limpiarForm = () => {
    setNuevaReserva({ titulo: '', sala_id: '1', fecha: '', horaInicio: '10:00', horaFin: '12:00', requerimientos: '' });
    setModoEdicion(false); setIdEventoEdicion(null);
  };

  if (!usuario) return <LoginScreen onLoginSuccess={setUsuario} />;

  return (
    <div className="h-screen flex flex-col font-sans bg-tec-gris-claro">
      <header className="bg-tec-azul text-white shadow-md z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-lg shadow-sm"><img src={logoTec} alt="Logo" className="h-8 md:h-10" /></div>
            <div><h1 className="text-xl md:text-2xl font-bold">Gestión de Espacios</h1><p className="text-xs text-gray-300">{usuario.nombre_completo}</p></div>
          </div>
          <div className="flex gap-3">
             <button className="bg-tec-verde text-white font-bold px-5 py-2.5 rounded-lg hover:bg-[#7ca835] shadow-lg" onClick={() => {limpiarForm(); setMostrarModal(true);}}>+ Nueva Reserva</button>
             <button className="bg-red-500 text-white font-bold px-4 rounded-lg text-sm hover:bg-red-600" onClick={() => setUsuario(null)}>Salir</button>
          </div>
        </div>
      </header>

      <main className="flex-grow p-6 max-w-7xl mx-auto w-full">
        <div className="bg-white h-full rounded-xl shadow-xl border border-gray-100 p-6 flex flex-col">
          <Calendar
            localizer={localizer} events={eventos} startAccessor="start" endAccessor="end" style={{ height: '100%' }} culture='es'
            date={date} view={view} onNavigate={onNavigate} onView={onView} components={{ toolbar: CustomToolbar }}
            messages={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día", agenda: "Agenda" }}
            onSelectEvent={setEventoSeleccionado}
            eventPropGetter={(event) => ({ style: { backgroundColor: event.resource === 'SUM' ? '#002F5D' : '#8DBD3E', color: '#fff', borderRadius: '6px', fontSize: '0.9em', border: 'none' } })}
          />
        </div>
      </main>

      {/* MODAL FORMULARIO (CREAR / EDITAR) */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-tec-azul bg-opacity-50 flex justify-center items-center z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-[500px] border-t-8 border-tec-verde animate-fade-in-up">
            <h2 className="text-2xl font-bold mb-4 text-tec-azul border-b pb-2">{modoEdicion ? '✏️ Editar Reserva' : '📅 Nueva Reserva'}</h2>
            <form onSubmit={guardarReserva} className="flex flex-col gap-4 text-gray-700">
              <input type="text" placeholder="Título" className="border p-3 rounded-lg w-full" required value={nuevaReserva.titulo} onChange={e => setNuevaReserva({...nuevaReserva, titulo: e.target.value})} />
              <div><label className="text-xs font-bold text-gray-400 uppercase ml-1">Responsable</label><input type="text" className="border p-3 rounded-lg w-full bg-gray-100 text-gray-500 cursor-not-allowed font-bold" value={usuario.nombre_completo} disabled /></div>
              <div className="grid grid-cols-2 gap-4">
                <select className="border p-3 rounded-lg" value={nuevaReserva.sala_id} onChange={e => setNuevaReserva({...nuevaReserva, sala_id: e.target.value})}><option value="1">Sala SUM</option><option value="2">Sala SAE</option></select>
                <input type="date" className="border p-3 rounded-lg" required value={nuevaReserva.fecha} onChange={e => setNuevaReserva({...nuevaReserva, fecha: e.target.value})} />
              </div>
              <div className="flex gap-2 items-center">
                <input type="time" className="border p-3 rounded-lg w-full" value={nuevaReserva.horaInicio} onChange={e => setNuevaReserva({...nuevaReserva, horaInicio: e.target.value})} /><span>a</span><input type="time" className="border p-3 rounded-lg w-full" value={nuevaReserva.horaFin} onChange={e => setNuevaReserva({...nuevaReserva, horaFin: e.target.value})} />
              </div>
              <textarea placeholder="Requerimientos..." className="border p-3 rounded-lg h-20" value={nuevaReserva.requerimientos} onChange={e => setNuevaReserva({...nuevaReserva, requerimientos: e.target.value})}></textarea>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setMostrarModal(false)} className="text-gray-500 font-bold">Cancelar</button>
                <button type="submit" className="bg-tec-azul text-white px-6 py-2 rounded-lg font-bold">{modoEdicion ? 'Guardar Cambios' : 'Crear Reserva'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLES */}
      {eventoSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
            <div className={`p-6 ${eventoSeleccionado.resource === 'SUM' ? 'bg-tec-azul' : 'bg-tec-verde'} text-white`}>
              <h3 className="text-2xl font-bold">{eventoSeleccionado.title}</h3>
              <p className="opacity-90 font-medium mt-1">{eventoSeleccionado.salaReal}</p>
            </div>
            <div className="p-6 flex flex-col gap-4 text-gray-700">
              <div className="flex items-start gap-3"><div className="bg-green-50 p-2 rounded-full text-tec-verde">👤</div><div><p className="text-xs font-bold text-gray-400 uppercase">Responsable</p><p className="font-semibold text-lg">{eventoSeleccionado.responsable}</p></div></div>
              <div className="flex items-start gap-3"><div className="bg-blue-50 p-2 rounded-full text-tec-azul">🕒</div><div><p className="text-xs font-bold text-gray-400 uppercase">Horario</p><p className="font-semibold">{format(eventoSeleccionado.start, 'h:mm a')} - {format(eventoSeleccionado.end, 'h:mm a')}</p></div></div>
              <div className="flex items-start gap-3"><div className="bg-yellow-50 p-2 rounded-full text-yellow-600">🛠</div><div><p className="text-xs font-bold text-gray-400 uppercase">Requerimientos</p><p className="bg-gray-50 p-3 rounded-lg text-sm mt-1 border border-gray-100">{eventoSeleccionado.requerimientos || "Ninguno"}</p></div></div>
            </div>
            
            {/* PIE DE PÁGINA: ACCIONES */}
            <div className="p-4 bg-gray-50 flex justify-between items-center border-t border-gray-100">
              <button className="text-gray-500 font-medium hover:text-gray-700" onClick={() => setEventoSeleccionado(null)}>Cerrar</button>
              
              {/* Solo mostrar acciones si el usuario es el responsable (Control de Personas) */}
              {usuario.nombre_completo === eventoSeleccionado.responsable && (
                <div className="flex gap-2">
                  <button onClick={eliminarReserva} className="px-4 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition">🗑 Eliminar</button>
                  <button onClick={iniciarEdicion} className="px-4 py-2 bg-tec-azul text-white font-bold rounded-lg hover:bg-opacity-90 transition">✏️ Editar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App;