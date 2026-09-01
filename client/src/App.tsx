import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import Overview from "./pages/Overview";
import DetectionStudio from "./pages/DetectionStudio";
import LookAlikeFeed from "./pages/LookAlikeFeed";
import WindLab from "./pages/WindLab";
import Transparency from "./pages/Transparency";
import AuditLog from "./pages/AuditLog";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/detection" component={DetectionStudio} />
        <Route path="/feed" component={LookAlikeFeed} />
        <Route path="/wind-lab" component={WindLab} />
        <Route path="/transparency" component={Transparency} />
        <Route path="/incidents" component={AuditLog} />
        <Route component={Overview} />
      </Switch>
    </DashboardLayout>
  );
}

export default function App() {
  return <Router />;
}
