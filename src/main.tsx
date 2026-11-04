import React, {Component} from "react";
import type {ErrorInfo,ReactNode} from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./style.css";
import App from "./App";

type CrashState={hasError:boolean;message:string;stack:string;componentStack:string};
class AppErrorBoundary extends Component<{children:ReactNode},CrashState>{
 constructor(props:{children:ReactNode}){super(props);this.state={hasError:false,message:"",stack:"",componentStack:""}}
 static getDerivedStateFromError(error:Error){return{hasError:true,message:error?.message??"Unknown rendering error",stack:error?.stack??""}}
 componentDidCatch(error:Error,info:ErrorInfo){console.error("World Simulator render failure:",error,info);this.setState({componentStack:info.componentStack??""})}
 reset=()=>{try{localStorage.removeItem("world-simulator-osm-beta-01")}catch{};window.location.reload()}
 render(){if(this.state.hasError)return <main className="crash-screen"><div className="crash-card"><div className="crash-code">ERROR 21112 · RECOVERABLE</div><h1>World Simulator gặp lỗi khi khởi chạy</h1><p>Đã ghi nhận lỗi giao diện cùng dấu vết kỹ thuật để xác định chính xác thành phần gây lỗi. Hãy gửi toàn bộ thông tin kỹ thuật cho nhà phát triển.</p><details open><summary>Thông tin kỹ thuật</summary><code>{this.state.message}{"\n\n"}{this.state.stack}{"\n\nREACT COMPONENT TREE"}{this.state.componentStack}</code></details><button onClick={()=>window.location.reload()}>Tải lại ứng dụng</button><button className="crash-secondary" onClick={this.reset}>Xóa bản lưu lỗi và khởi động lại</button></div></main>;return this.props.children}
}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>);
