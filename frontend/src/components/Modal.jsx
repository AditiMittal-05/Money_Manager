// Modal — a reusable popup component.
// Props:
//   open    = true/false — whether to show it
//   onClose = function to call when X is clicked
//   title   = heading text
//   children = the form content inside the modal

export default function Modal({ open, onClose, title, children }) {
  if (!open) return null   // if open is false, render nothing

  return (
    <div className="modal" onClick={onClose}>
      {/* stopPropagation prevents clicking inside the box from closing it */}
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
