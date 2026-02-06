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

// --- COMPONENTE DE BARRA (Mismo de antes) ---
const CustomToolbar = ({ onNavigate, onView, label, view }) => {
  const isActive = (viewName) => view === viewName ? 'bg-tec-verde text-white' : 'text-gray-500 hover:bg-gray-100';
  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 p-2 border-b border-gray-100 pb-4">
      <div className="flex gap-2">
        <button type="button" className="px-3 py-1 text-sm font-bold text-gray-600 border rounded hover:bg-gray-50" onClick={() => onNavigate('TODAY')}>Hoy</button>
        <div className="flex">
          <button type="button" className="px-3 py-1 text-gray-600 border-l border-t border-b rounded-l hover:bg-gray-50" onClick={() => onNavigate('PREV')}>← Ant.</button>
          <button type="button" className="px-3 py-1 text-gray-600 border rounded-r hover:bg-gray-50" onClick={() => onNavigate('NEXT')}>Sig. →</button>
        </div>
      </div>
      <span className="text-xl font-bold text-tec-azul uppercase tracking-wide">{label}</span>
      <div className="flex bg-gray-100 p-1 rounded-lg">
        {['month', 'week', 'day', 'agenda'].map(v => (
          <button key={v} type="button" onClick={() => onView(v)} className={`px-4 py-1 text-sm font-medium rounded-md transition uppercase ${isActive(v)}`}>
            {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : v === 'day' ? 'Día' : 'Agenda'}
          </button>
        ))}
      </div>
    </div>
  );
};

function App() {
  const [eventos, setEventos] = useState([]);
  const [mostrarModalCrear, setMostrarModalCrear] = useState(false);
  
  // NUEVO: Estado para ver detalles
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null); 

  // Control del Calendario
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState(Views.MONTH);
  const onNavigate = useCallback((newDate) => setDate(newDate), [setDate]);
  const onView = useCallback((newView) => setView(newView), [setView]);

  const [nuevaReserva, setNuevaReserva] = useState({
    titulo: '', responsable: '', sala_id: '1', fecha: '', horaInicio: '10:00', horaFin: '12:00', requerimientos: ''
  });

  const cargarReservas = async () => {
    try {
      const respuesta = await axios.get('http://localhost:3000/api/reservas');
      const eventosFormateados = respuesta.data.map(reserva => ({
        // Datos básicos para el calendario
        title: `${reserva.titulo_evento} (${reserva.nombre_sala})`,
        start: new Date(reserva.fecha_inicio),
        end: new Date(reserva.fecha_fin),
        resource: reserva.nombre_sala,
        // Datos extra para el Modal de Detalles
        responsable: reserva.responsable,
        requerimientos: reserva.requerimientos_fisicos,
        salaReal: reserva.nombre_sala
      }));
      setEventos(eventosFormateados);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { cargarReservas(); }, []);

  const guardarReserva = async (e) => {
    e.preventDefault();
    const startString = `${nuevaReserva.fecha} ${nuevaReserva.horaInicio}:00`;
    const endString = `${nuevaReserva.fecha} ${nuevaReserva.horaFin}:00`;
    try {
      await axios.post('http://localhost:3000/api/reservas', {
        sala_id: nuevaReserva.sala_id, 
        titulo: nuevaReserva.titulo, 
        responsable: nuevaReserva.responsable, // Enviamos responsable
        inicio: startString, 
        fin: endString, 
        requerimientos: nuevaReserva.requerimientos
      });
      alert('¡Reserva creada!');
      setMostrarModalCrear(false);
      cargarReservas();
      setNuevaReserva({ ...nuevaReserva, titulo: '', responsable: '', requerimientos: '' });
    } catch (error) { alert(error.response?.data?.error || 'Error'); }
  };

  // Acción al dar click en un evento
  const alSeleccionarEvento = (evento) => {
    setEventoSeleccionado(evento);
  };

  return (
    <div className="h-screen flex flex-col font-sans bg-tec-gris-claro">
      <header className="bg-tec-azul text-white shadow-md z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-lg shadow-sm"><img src={logoTec} alt="Logo" className="h-8 md:h-10" /></div>
            <div><h1 className="text-xl md:text-2xl font-bold">Gestión de Espacios</h1><p className="text-xs text-gray-300">Nivel Profesional</p></div>
          </div>
          <button className="bg-tec-verde text-white font-bold px-5 py-2.5 rounded-lg hover:bg-[#7ca835] shadow-lg" onClick={() => setMostrarModalCrear(true)}>+ Nueva Reserva</button>
        </div>
      </header>

      <main className="flex-grow p-6 max-w-7xl mx-auto w-full">
        <div className="bg-white h-full rounded-xl shadow-xl border border-gray-100 p-6 flex flex-col">
          <Calendar
            localizer={localizer} events={eventos} startAccessor="start" endAccessor="end" style={{ height: '100%' }} culture='es'
            date={date} view={view} onNavigate={onNavigate} onView={onView}
            components={{ toolbar: CustomToolbar }}
            messages={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día", agenda: "Agenda" }}
            
            // PROPIEDAD CLAVE PARA DETALLES
            onSelectEvent={alSeleccionarEvento}

            eventPropGetter={(event) => {
              const isSUM = event.resource === 'SUM';
              return { style: { backgroundColor: isSUM ? '#002F5D' : '#8DBD3E', color: '#fff', borderRadius: '6px', fontSize: '0.9em', border: 'none' } }
            }}
          />
        </div>
      </main>

      {/* --- MODAL CREAR RESERVA --- */}
      {mostrarModalCrear && (
        <div className="fixed inset-0 bg-tec-azul bg-opacity-50 flex justify-center items-center z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-[500px] border-t-8 border-tec-verde">
            <h2 className="text-2xl font-bold mb-4 text-tec-azul border-b pb-2">📅 Nueva Reserva</h2>
            <form onSubmit={guardarReserva} className="flex flex-col gap-4 text-gray-700">
              <input type="text" placeholder="Título del Evento" className="border p-3 rounded-lg w-full" required value={nuevaReserva.titulo} onChange={e => setNuevaReserva({...nuevaReserva, titulo: e.target.value})} />
              
              {/* CAMPO NUEVO: RESPONSABLE */}
              <input type="text" placeholder="Responsable (¿Quién reserva?)" className="border p-3 rounded-lg w-full" required value={nuevaReserva.responsable} onChange={e => setNuevaReserva({...nuevaReserva, responsable: e.target.value})} />

              <div className="grid grid-cols-2 gap-4">
                <select className="border p-3 rounded-lg" value={nuevaReserva.sala_id} onChange={e => setNuevaReserva({...nuevaReserva, sala_id: e.target.value})}>
                    <option value="1">Sala SUM</option><option value="2">Sala SAE</option>
                </select>
                <input type="date" className="border p-3 rounded-lg" required onChange={e => setNuevaReserva({...nuevaReserva, fecha: e.target.value})} />
              </div>
              <div className="flex gap-2 items-center">
                <input type="time" className="border p-3 rounded-lg w-full" value={nuevaReserva.horaInicio} onChange={e => setNuevaReserva({...nuevaReserva, horaInicio: e.target.value})} />
                <span>a</span>
                <input type="time" className="border p-3 rounded-lg w-full" value={nuevaReserva.horaFin} onChange={e => setNuevaReserva({...nuevaReserva, horaFin: e.target.value})} />
              </div>
              <textarea placeholder="Requerimientos (Sillas, audio...)" className="border p-3 rounded-lg h-20" value={nuevaReserva.requerimientos} onChange={e => setNuevaReserva({...nuevaReserva, requerimientos: e.target.value})}></textarea>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setMostrarModalCrear(false)} className="text-gray-500 font-bold">Cancelar</button>
                <button type="submit" className="bg-tec-azul text-white px-6 py-2 rounded-lg font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DETALLES DEL EVENTO --- */}
      {eventoSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
            
            {/* Encabezado del Modal con color según sala */}
            <div className={`p-6 ${eventoSeleccionado.resource === 'SUM' ? 'bg-tec-azul' : 'bg-tec-verde'} text-white`}>
              <h3 className="text-2xl font-bold">{eventoSeleccionado.title}</h3>
              <p className="opacity-90 font-medium mt-1">{eventoSeleccionado.salaReal}</p>
            </div>

            <div className="p-6 flex flex-col gap-4 text-gray-700">
              
              <div className="flex items-start gap-3">
                <div className="bg-blue-50 p-2 rounded-full text-tec-azul">🕒</div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Horario</p>
                  <p className="font-semibold">
                    {format(eventoSeleccionado.start, 'h:mm a')} - {format(eventoSeleccionado.end, 'h:mm a')}
                  </p>
                  <p className="text-sm text-gray-500">{format(eventoSeleccionado.start, "EEEE d 'de' MMMM", { locale: es })}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-green-50 p-2 rounded-full text-tec-verde">👤</div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Responsable</p>
                  <p className="font-semibold text-lg">{eventoSeleccionado.responsable || "No especificado"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-yellow-50 p-2 rounded-full text-yellow-600">🛠</div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Requerimientos</p>
                  <p className="bg-gray-50 p-3 rounded-lg text-sm mt-1 border border-gray-100">
                    {eventoSeleccionado.requerimientos || "Ninguno"}
                  </p>
                </div>
              </div>

            </div>

            <div className="p-4 bg-gray-50 flex justify-end">
              <button 
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition"
                onClick={() => setEventoSeleccionado(null)}
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default App;