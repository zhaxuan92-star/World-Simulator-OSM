import React, {Component} from "react";
import type {ErrorInfo,ReactNode} from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./style.css";
import App from "./App";

class AppErrorBoundary extends Component<{children:ReactNode},{hasError:boolean,message:string}>{
 constructor(props:{children:ReactNode}){super(props);this.state={hasError:false,message:""}}
 static getDerivedStateFromError(error:Error){return{hasError:true,message:error?.message??"Unknown rendering error"}}
 componentDidCatch(error:Error,info:ErrorInfo){console.error("World Simulator render failure:",error,info)}
 reset=()=>{try{localStorage.removeItem("world-simulator-osm-beta-01")}catch{};window.location.reload()}
 render(){if(this.state.hasError)return <main className="crash-screen"><div className="crash-card"><div className="crash-code">ERROR 31409 · RECOVERABLE</div><h1>World Simulator gặp lỗi khi khởi chạy</h1><p>Ứng dụng đã chặn màn hình trắng và phát hiện lỗi giao diện. Hãy thử tải lại; nếu dữ liệu lưu bị hỏng, dùng nút đặt lại bên dưới.</p><details><summary>Thông tin kỹ thuật</summary><code>{this.state.message}</code></details><button onClick={()=>window.location.reload()}>Tải lại ứng dụng</button><button className="crash-secondary" onClick={this.reset}>Xóa bản lưu lỗi và khởi động lại</button></div></main>;return this.props.children}
}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>);
